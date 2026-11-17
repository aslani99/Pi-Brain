-- Run against a disposable Supabase database after applying all migrations.
-- Every fixture is rolled back; this file must never be run against production
-- without an explicitly approved test environment.
begin;

do $$
declare
  v_profile uuid;
  v_alloc jsonb;
  v_delivery jsonb;
  v_answer jsonb;
  v_session uuid;
  v_first_seen uuid;
  v_new_first uuid;
  v_stage integer;
  v_count integer;
  v_i integer;
begin
  -- Formula and difficulty acceptance boundaries.
  if public.quiz_stage_question_count(1) <> 5
    or public.quiz_stage_question_count(5) <> 5
    or public.quiz_stage_question_count(6) <> 10
    or public.quiz_stage_question_count(10) <> 10
    or public.quiz_stage_question_count(11) <> 15
    or public.quiz_stage_question_count(196) <> 200
    or public.quiz_stage_question_count(200) <> 200
    or public.quiz_stage_question_count(201) <> 205
    or public.quiz_stage_question_count(206) <> 210 then
    raise exception 'Question-count formula acceptance test failed';
  end if;

  if public.quiz_stage_difficulty(1) <> 'easy'
    or public.quiz_stage_difficulty(50) <> 'easy'
    or public.quiz_stage_difficulty(51) <> 'medium'
    or public.quiz_stage_difficulty(100) <> 'medium'
    or public.quiz_stage_difficulty(101) <> 'hard'
    or public.quiz_stage_difficulty(150) <> 'hard'
    or public.quiz_stage_difficulty(151) <> 'very_hard'
    or public.quiz_stage_difficulty(200) <> 'very_hard'
    or public.quiz_stage_difficulty(201) <> 'expert' then
    raise exception 'Difficulty-boundary acceptance test failed';
  end if;

  insert into public.profiles(pi_uid, username, display_name, locale)
  values ('test-pi-brain-' || gen_random_uuid()::text, 'quiz-test', 'Quiz Test', 'en')
  returning id into v_profile;

  -- Thirty approved questions are enough for category and random-path tests.
  for v_i in 1..30 loop
    insert into public.questions(
      slug, category, difficulty, locale, prompt, options, answer_index,
      explanation, provenance, review_status, published_at
    ) values (
      'quiz-test-' || v_i || '-' || gen_random_uuid()::text,
      'Test Topic', 'easy', 'en',
      'Test question number ' || v_i || ' with a unique prompt?',
      jsonb_build_array('Correct', 'Option B', 'Option C', 'Option D'),
      0, 'Test explanation', 'human-authored', 'approved', now()
    );
  end loop;

  -- Start a category path and complete all five questions. The category path
  -- advances independently, and every delivered question enters global history.
  v_alloc := public.allocate_unseen_quiz(v_profile, 'en', 'Test Topic');
  v_session := (v_alloc->>'session_id')::uuid;
  if (v_alloc->>'stage')::integer <> 1 or (v_alloc->>'question_count')::integer <> 5
    or v_alloc->>'difficulty' <> 'easy' then
    raise exception 'Initial category allocation metadata is incorrect';
  end if;

  for v_i in 1..5 loop
    v_delivery := public.deliver_quiz_question(v_profile, v_session);
    v_answer := public.record_quiz_answer(
      v_profile, v_session, (v_delivery->>'question_id')::uuid, 0
    );
  end loop;

  select current_stage into v_stage
  from public.quiz_progress
  where profile_id = v_profile and path_key = 'Test Topic';
  if v_stage <> 2 then raise exception 'Completed category path did not advance exactly once'; end if;

  -- Start random path, display one question, then abandon it by starting again.
  -- The displayed question remains globally seen; the other reservations are freed.
  v_alloc := public.allocate_unseen_quiz(v_profile, 'en', '__random__');
  v_session := (v_alloc->>'session_id')::uuid;
  v_delivery := public.deliver_quiz_question(v_profile, v_session);
  v_first_seen := (v_delivery->>'question_id')::uuid;

  v_alloc := public.allocate_unseen_quiz(v_profile, 'en', '__random__');
  v_session := (v_alloc->>'session_id')::uuid;
  v_new_first := (v_alloc->'question_ids'->>0)::uuid;
  if v_first_seen = v_new_first then raise exception 'A displayed question was selected again on another path'; end if;

  select count(*) into v_count
  from public.question_seen_history
  where profile_id = v_profile and question_id = v_first_seen;
  if v_count <> 1 then raise exception 'Global seen history did not retain the abandoned question'; end if;

  select current_stage into v_stage
  from public.quiz_progress
  where profile_id = v_profile and path_key = '__random__';
  if v_stage <> 1 then raise exception 'Abandoning a random quiz incorrectly advanced its stage'; end if;

  -- The category path remains at its own second stage, with the correct count.
  v_alloc := public.allocate_unseen_quiz(v_profile, 'en', 'Test Topic');
  if (v_alloc->>'stage')::integer <> 2 or (v_alloc->>'question_count')::integer <> 10 then
    raise exception 'Switching paths changed category progress or stage sizing';
  end if;

  -- Draft questions must never be selected.
  insert into public.questions(
    slug, category, difficulty, locale, prompt, options, answer_index,
    explanation, provenance, review_status
  ) values (
    'quiz-test-draft-' || gen_random_uuid()::text, 'Draft Only', 'easy', 'en',
    'This is a draft question and must not be playable?',
    jsonb_build_array('A', 'B', 'C', 'D'), 0, 'Draft', 'ai-generated-original', 'draft'
  );
  if exists (
    select 1 from public.questions q
    where q.category = 'Draft Only' and q.review_status = 'approved'
  ) then raise exception 'Draft question approval state was modified unexpectedly'; end if;

  begin
    perform public.allocate_unseen_quiz(v_profile, 'en', 'Draft Only');
    raise exception 'A category containing only draft questions was incorrectly playable';
  exception when others then
    if sqlerrm not like 'Unknown or unpublished quiz category:%' then raise; end if;
  end;
  -- Each quiz locale is an independent bank: the Persian path must allocate
  -- only Persian rows even though other locales exist in the same database.
  for v_i in 1..5 loop
    insert into public.questions(
      slug, category, difficulty, locale, prompt, options, answer_index,
      explanation, provenance, review_status, published_at
    ) values (
      'locale-fa-' || v_i || '-' || gen_random_uuid()::text,
      'Locale Only', 'easy', 'fa',
      'پرسش آزمایشی شماره ' || v_i,
      jsonb_build_array('درست', 'گزینه ب', 'گزینه پ', 'گزینه ت'),
      0, 'توضیح آزمایشی', 'human-authored', 'approved', now()
    );
  end loop;

  v_alloc := public.allocate_unseen_quiz(v_profile, 'fa', 'Locale Only');
  if v_alloc->>'bank_status' is distinct from 'BANK_AVAILABLE' then
    raise exception 'Available locale bank status was not returned';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(v_alloc->'question_ids') selected(id)
    join public.questions q on q.id = selected.id::uuid
    where q.locale <> 'fa'
  ) then
    raise exception 'Quiz allocation mixed questions from different locales';
  end if;

  -- A locale with no approved rows is empty, not exhausted, for random
  -- and category paths alike (even when that category exists in English).
  begin
    perform public.allocate_unseen_quiz(v_profile, 'ar', '__random__');
    raise exception 'An empty locale bank was incorrectly allocated';
  exception when others then
    if sqlerrm not like 'BANK_EMPTY%' then raise; end if;
  end;

  begin
    perform public.allocate_unseen_quiz(v_profile, 'ar', 'Test Topic');
    raise exception 'A category with no approved questions in this locale was allocated';
  exception when others then
    if sqlerrm not like 'BANK_EMPTY%' then raise; end if;
  end;

  -- A bank with approved questions that have all been delivered is exhausted.
  for v_i in 1..5 loop
    insert into public.questions(
      slug, category, difficulty, locale, prompt, options, answer_index,
      explanation, provenance, review_status, published_at
    ) values (
      'locale-de-' || v_i || '-' || gen_random_uuid()::text,
      'Exhaustion Test', 'easy', 'de',
      'Testfrage Nummer ' || v_i,
      jsonb_build_array('Richtig', 'Option B', 'Option C', 'Option D'),
      0, 'Test explanation', 'human-authored', 'approved', now()
    );
  end loop;

  v_alloc := public.allocate_unseen_quiz(v_profile, 'de', 'Exhaustion Test');
  v_session := (v_alloc->>'session_id')::uuid;
  for v_i in 1..5 loop
    v_delivery := public.deliver_quiz_question(v_profile, v_session);
    v_answer := public.record_quiz_answer(
      v_profile, v_session, (v_delivery->>'question_id')::uuid, 0
    );
  end loop;

  begin
    perform public.allocate_unseen_quiz(v_profile, 'de', 'Exhaustion Test');
    raise exception 'An exhausted locale bank was incorrectly allocated';
  exception when others then
    if sqlerrm not like 'BANK_EXHAUSTED%' then raise; end if;
  end;
end $$;

rollback;
