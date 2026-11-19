-- Record +15 XP for correct, up to -3 XP for incorrect answers.
-- This replaces the authoritative DB function, not the browser UI alone.
-- Existing profile totals are preserved; historical attempts are not repriced.
-- The original quiz_attempts constraint disallowed negative point deltas.
alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_points_awarded_check;
alter table public.quiz_attempts
  add constraint quiz_attempts_points_awarded_check check (points_awarded >= -3);

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

  select * into v_profile from public.profiles where id = p_profile_id for update;
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
  -- A wrong answer deducts at most 3 XP. Record the actual deduction
  -- (0, -1, -2, or -3) so retries/history match the non-negative balance.
  v_points := case when v_correct then 15 else -least(v_profile.total_xp, 3)::integer end;

  insert into public.quiz_attempts(
    profile_id, session_id, question_id, selected_index, is_correct, points_awarded
  ) values (
    p_profile_id, p_session_id, p_question_id, p_selected_index, v_correct, v_points
  );

  update public.profiles
  set total_xp = greatest(0, total_xp + v_points),
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

-- Only the server's service role may grade answers.
revoke all on function public.record_quiz_answer(uuid, uuid, uuid, smallint)
  from public, anon, authenticated;
grant execute on function public.record_quiz_answer(uuid, uuid, uuid, smallint)
  to service_role;
