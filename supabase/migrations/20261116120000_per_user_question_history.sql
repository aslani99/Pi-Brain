-- Keep a permanent per-Pioneer record of every question allocated to a quiz.
-- Deleting a quiz session must not make its questions available again.
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

-- Backfill sessions created before this migration. A question in an old
-- session is treated as seen even if the Pioneer did not submit an answer.
insert into public.question_seen_history (
  profile_id, question_id, session_id, first_seen_at
)
select s.profile_id, seen.question_id, s.id, s.created_at
from public.quiz_sessions s
cross join lateral unnest(s.question_ids) as seen(question_id)
on conflict (profile_id, question_id) do nothing;

-- Lock the Pioneer row while allocating questions. This serializes concurrent
-- quiz starts for the same Pioneer, preventing the same unseen question from
-- being allocated to two sessions at once.
create or replace function public.allocate_unseen_quiz(
  p_profile_id uuid,
  p_locale text default 'en',
  p_count integer default 5
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_question_ids uuid[];
  v_session_id uuid;
  v_count integer := greatest(1, least(coalesce(p_count, 5), 10));
  v_locale text := coalesce(nullif(p_locale, ''), 'en');
begin
  select id into v_profile_id
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'Pioneer profile not found';
  end if;

  -- Select unseen questions from every category in the requested locale.
  select coalesce(array_agg(candidate.id), array[]::uuid[])
  into v_question_ids
  from (
    select q.id
    from public.questions q
    where q.review_status = 'approved'
      and q.locale = v_locale
      and not exists (
        select 1
        from public.question_seen_history h
        where h.profile_id = p_profile_id
          and h.question_id = q.id
      )
    order by random()
    limit v_count
  ) candidate;

  -- Match the existing behavior: use English only if the requested locale
  -- has no unseen approved questions at all.
  if cardinality(v_question_ids) = 0 and v_locale <> 'en' then
    select coalesce(array_agg(candidate.id), array[]::uuid[])
    into v_question_ids
    from (
      select q.id
      from public.questions q
      where q.review_status = 'approved'
        and q.locale = 'en'
        and not exists (
          select 1
          from public.question_seen_history h
          where h.profile_id = p_profile_id
            and h.question_id = q.id
        )
      order by random()
      limit v_count
    ) candidate;
  end if;

  if cardinality(v_question_ids) = 0 then
    raise exception 'No unseen approved questions are available';
  end if;

  insert into public.quiz_sessions (
    profile_id, question_ids, current_index, score, expires_at
  ) values (
    p_profile_id, v_question_ids, 0, 0, now() + interval '1 hour'
  )
  returning id into v_session_id;

  insert into public.question_seen_history (
    profile_id, question_id, session_id
  )
  select p_profile_id, selected.question_id, v_session_id
  from unnest(v_question_ids) as selected(question_id)
  on conflict (profile_id, question_id) do nothing;

  return jsonb_build_object(
    'session_id', v_session_id,
    'question_ids', to_jsonb(v_question_ids)
  );
end;
$$;

revoke all on function public.allocate_unseen_quiz(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.allocate_unseen_quiz(uuid, text, integer)
  to service_role;

comment on table public.question_seen_history is
  'Permanent per-Pioneer history of questions allocated to quiz sessions; questions are never removed from the shared bank.';
