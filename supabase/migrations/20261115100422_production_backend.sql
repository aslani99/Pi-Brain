-- Pi Brain production backend foundation.
-- All user-facing database access is routed through Edge Functions that verify
-- Pi identity server-side. No browser role can read answer keys or write XP.

alter table public.profiles
  add column if not exists username text,
  add column if not exists total_xp bigint not null default 0 check (total_xp >= 0),
  add column if not exists total_answered bigint not null default 0 check (total_answered >= 0),
  add column if not exists total_correct bigint not null default 0 check (total_correct >= 0),
  add column if not exists day_streak integer not null default 0 check (day_streak >= 0),
  add column if not exists last_active_date date,
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set username = coalesce(username, display_name, 'Pioneer')
where username is null;

alter table public.profiles alter column username set not null;
create index if not exists profiles_leaderboard_idx
  on public.profiles(total_xp desc, created_at asc);

alter table public.questions
  add column if not exists prompt_fingerprint text;
create unique index if not exists questions_prompt_fingerprint_uidx
  on public.questions(prompt_fingerprint)
  where prompt_fingerprint is not null;

-- Near-duplicate screening for generated question prompts (trigram text similarity).
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions;
create index if not exists questions_prompt_trgm_idx
  on public.questions using gin (lower(prompt) gin_trgm_ops);
reset search_path;

create or replace function public.find_near_duplicate_question_prompts(
  p_prompts text[],
  p_threshold real default 0.72
)
returns table(candidate_prompt text, similar_prompt text, similarity_score real)
language sql
security invoker
set search_path = public, extensions
as $$
  with candidates as (
    select distinct btrim(candidate) as candidate_prompt
    from unnest(coalesce(p_prompts, array[]::text[])) as input(candidate)
    where candidate is not null and btrim(candidate) <> ''
  ),
  existing_matches as (
    select c.candidate_prompt, q.prompt as similar_prompt,
      similarity(lower(c.candidate_prompt), lower(q.prompt))::real as similarity_score
    from candidates c
    join public.questions q
      on lower(c.candidate_prompt) % lower(q.prompt)
     and similarity(lower(c.candidate_prompt), lower(q.prompt)) >= greatest(0.0, least(p_threshold, 1.0))
    where q.review_status <> 'rejected'
  ),
  batch_matches as (
    select a.candidate_prompt, b.candidate_prompt as similar_prompt,
      similarity(lower(a.candidate_prompt), lower(b.candidate_prompt))::real as similarity_score
    from candidates a
    join candidates b on a.candidate_prompt > b.candidate_prompt
    where similarity(lower(a.candidate_prompt), lower(b.candidate_prompt)) >= greatest(0.0, least(p_threshold, 1.0))
  )
  select * from existing_matches
  union all
  select * from batch_matches;
$$;

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 20),
  current_index integer not null default 0 check (current_index >= 0),
  score integer not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  completed_at timestamptz
);

alter table public.quiz_attempts
  add column if not exists session_id uuid references public.quiz_sessions(id) on delete cascade;

create unique index if not exists quiz_attempts_session_question_uidx
  on public.quiz_attempts(session_id, question_id)
  where session_id is not null;
create index if not exists quiz_sessions_profile_created_idx
  on public.quiz_sessions(profile_id, created_at desc);

-- Atomic, idempotent answer recording. Only the trusted Edge Function's
-- service-role client may execute this RPC. Clients never submit XP values.
create or replace function public.record_quiz_answer(
  p_profile_id uuid,
  p_session_id uuid,
  p_question_id uuid,
  p_selected_index smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_question public.questions%rowtype;
  v_attempt public.quiz_attempts%rowtype;
  v_profile public.profiles%rowtype;
  v_correct boolean;
  v_points integer;
  v_next_index integer;
  v_today date := (timezone('utc', now()))::date;
begin
  if p_selected_index < 0 or p_selected_index > 3 then
    raise exception 'Selected answer is outside the allowed range';
  end if;

  select * into v_session
  from public.quiz_sessions
  where id = p_session_id and profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'Quiz session not found for this Pioneer';
  end if;

  select * into v_question
  from public.questions
  where id = p_question_id and review_status = 'approved';

  if not found then
    raise exception 'Question is not available';
  end if;

  -- Return a previous answer if the request is retried. Never award twice.
  select * into v_attempt
  from public.quiz_attempts
  where session_id = p_session_id and question_id = p_question_id;

  if found then
    select * into v_profile from public.profiles where id = p_profile_id;
    return jsonb_build_object(
      'correct', v_attempt.is_correct,
      'answer_index', v_question.answer_index,
      'explanation', v_question.explanation,
      'points_awarded', v_attempt.points_awarded,
      'score', v_session.score,
      'completed', v_session.completed_at is not null,
      'duplicate', true,
      'profile', jsonb_build_object(
        'total_xp', v_profile.total_xp,
        'total_answered', v_profile.total_answered,
        'total_correct', v_profile.total_correct,
        'day_streak', v_profile.day_streak,
        'last_active_date', v_profile.last_active_date
      )
    );
  end if;

  if v_session.completed_at is not null then
    raise exception 'Quiz session is already complete';
  end if;
  if v_session.expires_at < now() then
    raise exception 'Quiz session has expired';
  end if;
  if v_session.current_index >= cardinality(v_session.question_ids) then
    raise exception 'Quiz session has no remaining questions';
  end if;
  if v_session.question_ids[v_session.current_index + 1] <> p_question_id then
    raise exception 'Question does not match the current quiz position';
  end if;

  v_correct := p_selected_index = v_question.answer_index;
  v_points := case when v_correct then 15 else 0 end;

  insert into public.quiz_attempts(
    profile_id, session_id, question_id, selected_index, is_correct, points_awarded
  ) values (
    p_profile_id, p_session_id, p_question_id, p_selected_index, v_correct, v_points
  );

  update public.profiles
  set total_xp = total_xp + v_points,
      total_answered = total_answered + 1,
      total_correct = total_correct + case when v_correct then 1 else 0 end,
      day_streak = case
        when last_active_date = v_today then day_streak
        when last_active_date = v_today - 1 then day_streak + 1
        else 1
      end,
      last_active_date = v_today,
      updated_at = now()
  where id = p_profile_id
  returning * into v_profile;

  v_next_index := v_session.current_index + 1;
  update public.quiz_sessions
  set current_index = v_next_index,
      score = score + case when v_correct then 1 else 0 end,
      completed_at = case
        when v_next_index >= cardinality(question_ids) then now()
        else completed_at
      end
  where id = p_session_id
  returning * into v_session;

  return jsonb_build_object(
    'correct', v_correct,
    'answer_index', v_question.answer_index,
    'explanation', v_question.explanation,
    'points_awarded', v_points,
    'score', v_session.score,
    'completed', v_session.completed_at is not null,
    'duplicate', false,
    'profile', jsonb_build_object(
      'total_xp', v_profile.total_xp,
      'total_answered', v_profile.total_answered,
      'total_correct', v_profile.total_correct,
      'day_streak', v_profile.day_streak,
      'last_active_date', v_profile.last_active_date
    )
  );
end;
$$;

-- Remove all direct browser access. The service role is held only by Edge Functions.
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_sessions enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.questions from anon, authenticated;
revoke all on table public.quiz_attempts from anon, authenticated;
revoke all on table public.quiz_sessions from anon, authenticated;

grant all on table public.profiles to service_role;
grant all on table public.questions to service_role;
grant all on table public.quiz_attempts to service_role;
grant all on table public.quiz_sessions to service_role;

revoke all on function public.record_quiz_answer(uuid, uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.record_quiz_answer(uuid, uuid, uuid, smallint) to service_role;
revoke all on function public.find_near_duplicate_question_prompts(text[], real) from public, anon, authenticated;
grant execute on function public.find_near_duplicate_question_prompts(text[], real) to service_role;

comment on table public.questions is 'Private answer-key table. Never select directly from the browser; serve question fields through authenticated Edge Functions.';
comment on table public.quiz_attempts is 'Server-recorded attempts. XP and correctness are derived on the database server.';
comment on table public.quiz_sessions is 'Server-owned quiz sessions. Question order and current position are not client-controlled.';
