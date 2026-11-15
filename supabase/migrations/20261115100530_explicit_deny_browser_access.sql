-- Browser clients receive no direct access to any private Pi Brain data.
-- Edge Functions verify Pi access tokens and use the server-side Supabase key.
create index if not exists quiz_attempts_question_idx
  on public.quiz_attempts(question_id);

create policy "deny browser access to profiles"
  on public.profiles for all to anon, authenticated
  using (false) with check (false);

create policy "deny browser access to question answer keys"
  on public.questions for all to anon, authenticated
  using (false) with check (false);

create policy "deny browser access to quiz attempts"
  on public.quiz_attempts for all to anon, authenticated
  using (false) with check (false);

create policy "deny browser access to quiz sessions"
  on public.quiz_sessions for all to anon, authenticated
  using (false) with check (false);
