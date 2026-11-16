-- Pi Brain staged quiz system.
-- This upgrade intentionally follows 20261116120000_per_user_question_history.sql.
-- It is prepared locally only; do not apply to Supabase without owner approval.

-- ---------------------------------------------------------------------------
-- 1. Expand question difficulty values for advanced stages.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%difficulty%'
  loop
    execute format('alter table public.questions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.questions
  add constraint questions_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard', 'very_hard', 'expert'));

-- ---------------------------------------------------------------------------
-- 2. Repair legacy history. The previous migration recorded every reserved
--    question. Keep the first question and answered questions only: later
--    unanswered questions cannot be proven to have reached the screen.
create table if not exists public.question_seen_history (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  session_id uuid references public.quiz_sessions(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  primary key (profile_id, question_id)
);

create index if not exists question_seen_history_profile_idx
  on public.question_seen_history(profile_id, first_seen_at desc);

alter table public.question_seen_history enable row level security;
revoke all on table public.question_seen_history from anon, authenticated;
grant all on table public.question_seen_history to service_role;

delete from public.question_seen_history h
using public.quiz_sessions s
where h.session_id = s.id
  and coalesce(s.question_ids[1], '00000000-0000-0000-0000-000000000000'::uuid) <> h.question_id
  and not exists (
    select 1 from public.quiz_attempts a
    where a.session_id = s.id and a.question_id = h.question_id
  );

-- The first question was returned when a legacy session started.
insert into public.question_seen_history(profile_id, question_id, session_id, first_seen_at)
select s.profile_id, s.question_ids[1], s.id, s.created_at
from public.quiz_sessions s
where cardinality(s.question_ids) >= 1
on conflict (profile_id, question_id) do nothing;

-- Answers prove that the question was displayed, including legacy attempts
-- that predate session_id support.
insert into public.question_seen_history(profile_id, question_id, session_id, first_seen_at)
select a.profile_id, a.question_id, a.session_id, a.created_at
from public.quiz_attempts a
on conflict (profile_id, question_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Per-user, per-path progress. The random path is stored as __random__.
create table if not exists public.quiz_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  path_key text not null,
  current_stage integer not null default 1 check (current_stage >= 1),
  completed_stages integer not null default 0 check (completed_stages >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, path_key),
  constraint quiz_progress_path_key_check
    check (path_key = '__random__' or (length(btrim(path_key)) between 1 and 64))
);

alter table public.quiz_progress enable row level security;
revoke all on table public.quiz_progress from anon, authenticated;
grant all on table public.quiz_progress to service_role;

-- ---------------------------------------------------------------------------
-- 4. Expand quiz_sessions and remove the old 1..20 question-array limit.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.quiz_sessions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%cardinality%question_ids%'
  loop
    execute format('alter table public.quiz_sessions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.quiz_sessions
  add column if not exists path_key text not null default '__random__',
  add column if not exists stage_number integer not null default 1,
  add column if not exists difficulty text not null default 'easy',
  add column if not exists question_count integer,
  add column if not exists abandoned_at timestamptz;

update public.quiz_sessions
set question_count = cardinality(question_ids)
where question_count is null;

alter table public.quiz_sessions alter column question_count set not null;

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.quiz_sessions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%difficulty%'
  loop
    execute format('alter table public.quiz_sessions drop constraint %I', c.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_sessions'::regclass
      and conname = 'quiz_sessions_difficulty_check'
  ) then
    alter table public.quiz_sessions add constraint quiz_sessions_difficulty_check
      check (difficulty in ('easy', 'medium', 'hard', 'very_hard', 'expert'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_sessions'::regclass
      and conname = 'quiz_sessions_stage_number_check'
  ) then
    alter table public.quiz_sessions add constraint quiz_sessions_stage_number_check
      check (stage_number >= 1);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_sessions'::regclass
      and conname = 'quiz_sessions_question_count_check'
  ) then
    alter table public.quiz_sessions add constraint quiz_sessions_question_count_check
      check (question_count >= 1 and question_count = cardinality(question_ids));
  end if;
end $$;

create index if not exists quiz_sessions_profile_path_stage_idx
  on public.quiz_sessions(profile_id, path_key, stage_number desc, created_at desc);

-- Reservations are temporary; unlike question_seen_history they may be released.
create table if not exists public.question_reservations (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (profile_id, question_id)
);

create index if not exists question_reservations_session_idx
  on public.question_reservations(session_id);
create index if not exists question_reservations_expiry_idx
  on public.question_reservations(expires_at);

alter table public.question_reservations enable row level security;
revoke all on table public.question_reservations from anon, authenticated;
grant all on table public.question_reservations to service_role;

-- ---------------------------------------------------------------------------
-- 5. Canonical stage rules. Arithmetic uses bigint to avoid integer overflow.
create or replace function public.quiz_stage_question_count(p_stage integer)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_stage < 1 then raise exception 'Stage must be at least 1'; end if;
  v_count := 5::bigint * ((p_stage::bigint + 4) / 5);
  if v_count > 2147483647 then
    raise exception 'Stage exceeds the supported question-count range';
  end if;
  return v_count::integer;
end;
$$;

create or replace function public.quiz_stage_difficulty(p_stage integer)
returns text
language plpgsql
immutable
strict
set search_path = public
as $$
begin
  if p_stage < 1 then raise exception 'Stage must be at least 1'; end if;
  return case
    when p_stage <= 50 then 'easy'
    when p_stage <= 100 then 'medium'
    when p_stage <= 150 then 'hard'
    when p_stage <= 200 then 'very_hard'
    else 'expert'
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Atomic allocation. Locking the profile serializes starts for a user.
--    Questions are only marked permanently seen when delivered to the UI.
drop function if exists public.allocate_unseen_quiz(uuid, text, integer);
drop function if exists public.allocate_unseen_quiz(uuid, text, text);

create or replace function public.allocate_unseen_quiz(
  p_profile_id uuid,
  p_locale text default 'en',
  p_path_key text default '__random__'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_locale text := coalesce(nullif(p_locale, ''), 'en');
  v_path_key text := coalesce(nullif(p_path_key, ''), '__random__');
  v_stage integer;
  v_required integer;
  v_difficulty text;
  v_question_ids uuid[];
  v_available bigint;
  v_session_id uuid;
  v_expires_at timestamptz := now() + interval '1 hour';
begin
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'Pioneer profile not found'; end if;

  if v_path_key <> '__random__' and not exists (
    select 1 from public.questions q
    where q.category = v_path_key and q.review_status = 'approved'
  ) then
    raise exception 'Unknown or unpublished quiz category: %', v_path_key;
  end if;

  insert into public.quiz_progress(profile_id, path_key)
  values (p_profile_id, v_path_key)
  on conflict (profile_id, path_key) do nothing;

  select current_stage into v_stage
  from public.quiz_progress
  where profile_id = p_profile_id and path_key = v_path_key
  for update;

  v_required := public.quiz_stage_question_count(v_stage);
  v_difficulty := public.quiz_stage_difficulty(v_stage);

  -- Starting a new quiz abandons all other incomplete sessions for this user.
  -- Only undelivered reservations are released; permanent history is retained.
  update public.quiz_sessions
  set abandoned_at = now()
  where profile_id = p_profile_id
    and completed_at is null
    and abandoned_at is null;

  delete from public.question_reservations qr
  using public.quiz_sessions s
  where qr.session_id = s.id
    and s.profile_id = p_profile_id
    and (s.abandoned_at is not null or s.expires_at <= now());

  delete from public.question_reservations
  where profile_id = p_profile_id and expires_at <= now();

  select count(*) into v_available
  from public.questions q
  where q.review_status = 'approved'
    and q.difficulty = v_difficulty
    and q.locale in (v_locale, case when v_locale <> 'en' then 'en' else v_locale end)
    and (v_path_key = '__random__' or q.category = v_path_key)
    and not exists (
      select 1 from public.question_seen_history h
      where h.profile_id = p_profile_id and h.question_id = q.id
    )
    and not exists (
      select 1 from public.question_reservations r
      where r.profile_id = p_profile_id and r.question_id = q.id
    );

  if v_available < v_required then
    raise exception 'INSUFFICIENT_QUESTION_BANK: required %, available %, difficulty %, path %',
      v_required, v_available, v_difficulty, v_path_key;
  end if;

  select array_agg(candidate.id order by candidate.locale_priority desc, candidate.random_order)
  into v_question_ids
  from (
    select q.id,
      (q.locale = v_locale) as locale_priority,
      random() as random_order
    from public.questions q
    where q.review_status = 'approved'
      and q.difficulty = v_difficulty
      and q.locale in (v_locale, case when v_locale <> 'en' then 'en' else v_locale end)
      and (v_path_key = '__random__' or q.category = v_path_key)
      and not exists (
        select 1 from public.question_seen_history h
        where h.profile_id = p_profile_id and h.question_id = q.id
      )
      and not exists (
        select 1 from public.question_reservations r
        where r.profile_id = p_profile_id and r.question_id = q.id
      )
    order by (q.locale = v_locale) desc, random()
    limit v_required
  ) candidate;

  if coalesce(cardinality(v_question_ids), 0) <> v_required then
    raise exception 'Question bank changed during allocation; please retry';
  end if;

  insert into public.quiz_sessions(
    profile_id, question_ids, current_index, score, expires_at,
    path_key, stage_number, difficulty, question_count
  ) values (
    p_profile_id, v_question_ids, 0, 0, v_expires_at,
    v_path_key, v_stage, v_difficulty, v_required
  ) returning id into v_session_id;

  insert into public.question_reservations(profile_id, question_id, session_id, expires_at)
  select p_profile_id, item.question_id, v_session_id, v_expires_at
  from unnest(v_question_ids) as item(question_id);

  return jsonb_build_object(
    'session_id', v_session_id,
    'path_key', v_path_key,
    'stage', v_stage,
    'question_count', v_required,
    'difficulty', v_difficulty,
    'question_ids', to_jsonb(v_question_ids)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Deliver the current question. This is idempotent for retrying clients.
create or replace function public.deliver_quiz_question(
  p_profile_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_question_id uuid;
  v_question public.questions%rowtype;
  v_existing_session uuid;
begin
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'Pioneer profile not found'; end if;

  select * into v_session
  from public.quiz_sessions
  where id = p_session_id and profile_id = p_profile_id
  for update;
  if not found then raise exception 'Quiz session not found for this Pioneer'; end if;
  if v_session.abandoned_at is not null then raise exception 'Quiz session was abandoned'; end if;
  if v_session.completed_at is not null then raise exception 'Quiz session is already complete'; end if;
  if v_session.expires_at <= now() then raise exception 'Quiz session has expired'; end if;

  insert into public.quiz_progress(profile_id, path_key)
  values (p_profile_id, v_session.path_key)
  on conflict (profile_id, path_key) do nothing;
  if not exists (
    select 1 from public.quiz_progress qp
    where qp.profile_id = p_profile_id
      and qp.path_key = v_session.path_key
      and qp.current_stage = v_session.stage_number
  ) then raise exception 'Quiz stage is no longer current'; end if;

  if v_session.current_index >= cardinality(v_session.question_ids) then
    raise exception 'Quiz session has no remaining questions';
  end if;

  v_question_id := v_session.question_ids[v_session.current_index + 1];
  select * into v_question
  from public.questions q
  where q.id = v_question_id and q.review_status = 'approved';
  if not found then raise exception 'Question is no longer approved'; end if;

  if not exists (
    select 1 from public.question_reservations r
    where r.profile_id = p_profile_id
      and r.question_id = v_question_id
      and r.session_id = p_session_id
  ) and not exists (
    select 1 from public.question_seen_history h
    where h.profile_id = p_profile_id
      and h.question_id = v_question_id
      and h.session_id = p_session_id
  ) then raise exception 'Question reservation is no longer valid'; end if;

  select session_id into v_existing_session
  from public.question_seen_history
  where profile_id = p_profile_id and question_id = v_question_id;
  if found and v_existing_session is distinct from p_session_id then
    raise exception 'Question was already displayed in another session';
  end if;

  insert into public.question_seen_history(profile_id, question_id, session_id)
  values (p_profile_id, v_question_id, p_session_id)
  on conflict (profile_id, question_id) do nothing;

  delete from public.question_reservations
  where profile_id = p_profile_id and question_id = v_question_id and session_id = p_session_id;

  return jsonb_build_object(
    'question_id', v_question_id,
    'question_index', v_session.current_index,
    'stage', v_session.stage_number,
    'question_count', v_session.question_count,
    'difficulty', v_session.difficulty,
    'path_key', v_session.path_key,
    'question', jsonb_build_object(
      'id', v_question.id,
      'category', v_question.category,
      'difficulty', v_question.difficulty,
      'prompt', v_question.prompt,
      'options', v_question.options
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Record answers once; promote only after the final answer and only if the
--    session still matches the current stage of the same path.
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
  v_stage_now integer;
  v_stage_advanced boolean := false;
  v_next_stage integer;
  v_today date := (timezone('utc', now()))::date;
begin
  if p_selected_index < 0 or p_selected_index > 3 then
    raise exception 'Selected answer is outside the allowed range';
  end if;

  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'Pioneer profile not found'; end if;

  select * into v_session
  from public.quiz_sessions
  where id = p_session_id and profile_id = p_profile_id
  for update;
  if not found then raise exception 'Quiz session not found for this Pioneer'; end if;

  select * into v_question
  from public.questions
  where id = p_question_id and review_status = 'approved';
  if not found then raise exception 'Question is not available'; end if;

  -- A retried request returns its original grade without awarding XP twice.
  select * into v_attempt
  from public.quiz_attempts
  where session_id = p_session_id and question_id = p_question_id;
  if found then
    select * into v_profile from public.profiles where id = p_profile_id;
    select current_stage into v_stage_now from public.quiz_progress
      where profile_id = p_profile_id and path_key = v_session.path_key;
    return jsonb_build_object(
      'correct', v_attempt.is_correct,
      'answer_index', v_question.answer_index,
      'explanation', v_question.explanation,
      'points_awarded', v_attempt.points_awarded,
      'score', v_session.score,
      'completed', v_session.completed_at is not null,
      'stage', v_session.stage_number,
      'next_stage', coalesce(v_stage_now, v_session.stage_number),
      'stage_advanced', false,
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

  if v_session.abandoned_at is not null then raise exception 'Quiz session was abandoned'; end if;
  if v_session.completed_at is not null then raise exception 'Quiz session is already complete'; end if;
  if v_session.expires_at <= now() then raise exception 'Quiz session has expired'; end if;
  if v_session.current_index >= cardinality(v_session.question_ids) then
    raise exception 'Quiz session has no remaining questions';
  end if;
  if v_session.question_ids[v_session.current_index + 1] <> p_question_id then
    raise exception 'Question does not match the current quiz position';
  end if;
  if not exists (
    select 1 from public.question_seen_history h
    where h.profile_id = p_profile_id
      and h.question_id = p_question_id
      and h.session_id = p_session_id
  ) then raise exception 'Question must be delivered before it can be answered'; end if;

  insert into public.quiz_progress(profile_id, path_key)
  values (p_profile_id, v_session.path_key)
  on conflict (profile_id, path_key) do nothing;
  select current_stage into v_stage_now
  from public.quiz_progress
  where profile_id = p_profile_id and path_key = v_session.path_key
  for update;
  if v_stage_now is distinct from v_session.stage_number then
    raise exception 'Quiz stage is no longer current';
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
      completed_at = case when v_next_index >= question_count then now() else completed_at end
  where id = p_session_id
  returning * into v_session;

  if v_session.completed_at is not null then
    delete from public.question_reservations where session_id = p_session_id;
    update public.quiz_progress
    set current_stage = current_stage + 1,
        completed_stages = completed_stages + 1,
        updated_at = now()
    where profile_id = p_profile_id
      and path_key = v_session.path_key
      and current_stage = v_session.stage_number
    returning current_stage into v_next_stage;
    v_stage_advanced := found;
    if not v_stage_advanced then
      select current_stage into v_next_stage from public.quiz_progress
      where profile_id = p_profile_id and path_key = v_session.path_key;
    end if;
  else
    v_next_stage := v_stage_now;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'answer_index', v_question.answer_index,
    'explanation', v_question.explanation,
    'points_awarded', v_points,
    'score', v_session.score,
    'completed', v_session.completed_at is not null,
    'stage', v_session.stage_number,
    'next_stage', coalesce(v_next_stage, v_stage_now),
    'stage_advanced', v_stage_advanced,
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

-- ---------------------------------------------------------------------------
-- 9. Return the dynamic approved category list and this user's path progress.
create or replace function public.get_quiz_catalog(p_profile_id uuid, p_locale text default 'en')
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_categories jsonb;
  v_progress jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Pioneer profile not found';
  end if;

  select coalesce(jsonb_agg(category_name order by category_name), '[]'::jsonb)
  into v_categories
  from (
    select distinct q.category as category_name
    from public.questions q
    where q.review_status = 'approved'
      and q.locale in (coalesce(nullif(p_locale, ''), 'en'), 'en')
  ) c;

  select coalesce(jsonb_object_agg(path_key, current_stage), '{}'::jsonb)
  into v_progress
  from public.quiz_progress
  where profile_id = p_profile_id;

  return jsonb_build_object('categories', v_categories, 'progress', v_progress);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Restrict privileged RPCs to service_role Edge Functions.
revoke all on function public.allocate_unseen_quiz(uuid, text, text) from public, anon, authenticated;
revoke all on function public.deliver_quiz_question(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_quiz_answer(uuid, uuid, uuid, smallint) from public, anon, authenticated;
revoke all on function public.get_quiz_catalog(uuid, text) from public, anon, authenticated;

grant execute on function public.allocate_unseen_quiz(uuid, text, text) to service_role;
grant execute on function public.deliver_quiz_question(uuid, uuid) to service_role;
grant execute on function public.record_quiz_answer(uuid, uuid, uuid, smallint) to service_role;
grant execute on function public.get_quiz_catalog(uuid, text) to service_role;

comment on table public.question_seen_history is
  'Permanent per-Pioneer record of questions delivered to the quiz UI; shared across all category and random paths.';
comment on table public.quiz_progress is
  'Independent current stage per Pioneer and quiz path; __random__ is the all-category random path.';
comment on table public.question_reservations is
  'Temporary reservations for allocated but not-yet-delivered questions; these may be released on abandonment or expiry.';
comment on table public.quiz_sessions is
  'Server-owned staged quiz sessions; question_count follows 5 * ceil(stage_number / 5), without a 10/20-question cap.';
