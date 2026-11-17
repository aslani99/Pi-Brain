-- Pi Brain account-linked preferences.
-- Browser roles cannot read or write preferences; Edge Functions verify Pi identity first.
create table if not exists public.user_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1)
);

create index if not exists user_preferences_updated_at_idx
  on public.user_preferences(updated_at desc);

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from anon, authenticated;
grant all on table public.user_preferences to service_role;

-- Atomic version check prevents an older device from overwriting newer preferences.
-- profile_id is supplied only by the trusted Edge Function after Pi UID verification.
create or replace function public.save_user_preferences(
  p_profile_id uuid,
  p_preferences jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_preferences%rowtype;
  v_language text;
begin
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Invalid preferences payload';
  end if;

  v_language := coalesce(p_preferences ->> 'language', 'en');
  if v_language !~ '^(en|fa|ar|de|es|fr|ru|tr|hi|zh|ja|pt)$' then
    raise exception 'Unsupported preference language';
  end if;

  insert into public.user_preferences(profile_id, preferences, version)
  values (p_profile_id, p_preferences, 1)
  on conflict (profile_id) do update
    set preferences = excluded.preferences,
        version = public.user_preferences.version + 1,
        updated_at = now()
    where public.user_preferences.version = p_expected_version
  returning * into v_row;

  if not found then
    raise exception 'PREFERENCES_VERSION_CONFLICT';
  end if;

  update public.profiles
  set locale = v_language,
      updated_at = now()
  where id = p_profile_id;

  return jsonb_build_object(
    'preferences', v_row.preferences,
    'version', v_row.version,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.save_user_preferences(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_user_preferences(uuid, jsonb, integer) to service_role;

-- A translated question is a separate row with the same stable slug and a different locale.
-- Replace the original global slug uniqueness with a per-locale uniqueness rule.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.questions'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (slug)'
  loop
    execute format('alter table public.questions drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists questions_slug_locale_uidx
  on public.questions(slug, locale);

-- A quiz session must never mix translated and English questions.
-- If the requested locale lacks enough approved unseen questions, use a complete
-- English set only when that full set is available.

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
  v_english_available bigint;
  v_selected_locale text;
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
    and q.locale = v_locale
    and (v_path_key = '__random__' or q.category = v_path_key)
    and not exists (
      select 1 from public.question_seen_history h
      where h.profile_id = p_profile_id and h.question_id = q.id
    )
    and not exists (
      select 1 from public.question_reservations r
      where r.profile_id = p_profile_id and r.question_id = q.id
    );

  v_selected_locale := v_locale;
  if v_available < v_required and v_locale <> 'en' then
    select count(*) into v_english_available
    from public.questions q
    where q.review_status = 'approved'
      and q.difficulty = v_difficulty
      and q.locale = 'en'
      and (v_path_key = '__random__' or q.category = v_path_key)
      and not exists (
        select 1 from public.question_seen_history h
        where h.profile_id = p_profile_id and h.question_id = q.id
      )
      and not exists (
        select 1 from public.question_reservations r
        where r.profile_id = p_profile_id and r.question_id = q.id
      );

    if v_english_available >= v_required then
      v_selected_locale := 'en';
      v_available := v_english_available;
    end if;
  end if;

  if v_available < v_required then
    raise exception 'INSUFFICIENT_QUESTION_BANK: required %, available %, difficulty %, path %, locale %',
      v_required, v_available, v_difficulty, v_path_key, v_selected_locale;
  end if;

  select array_agg(candidate.id order by candidate.locale_priority desc, candidate.random_order)
  into v_question_ids
  from (
    select q.id,
      true as locale_priority,
      random() as random_order
    from public.questions q
    where q.review_status = 'approved'
      and q.difficulty = v_difficulty
      and q.locale = v_selected_locale
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
