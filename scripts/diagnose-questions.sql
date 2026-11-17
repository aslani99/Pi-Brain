-- READ ONLY. Run in Supabase SQL Editor for the linked Pi-Brain project.
-- This does not change question status, approve questions or spend AI credits.
select count(*) as total_questions,
       count(*) filter (where review_status = 'approved') as approved,
       count(*) filter (where review_status = 'draft') as draft,
       count(*) filter (where review_status = 'rejected') as rejected,
       count(*) filter (where coalesce(jsonb_array_length(source_refs), 0) = 0) as missing_sources
from public.questions;

select locale, category, difficulty, review_status, count(*) as question_count
from public.questions
group by locale, category, difficulty, review_status
order by locale, category, difficulty, review_status;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'questions'
order by ordinal_position;

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('questions','profiles','quiz_sessions','quiz_attempts',
                   'quiz_progress','question_seen_history','question_reservations',
                   'user_preferences')
order by tablename, policyname;
