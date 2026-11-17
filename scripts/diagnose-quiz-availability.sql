-- Read-only diagnosis for empty quiz catalog / start-quiz.
-- Run in Supabase SQL Editor. Each result set is small.

-- A. Published inventory by quiz locale and category.
select locale, category, difficulty, count(*) as approved_count
from public.questions
where review_status = 'approved'
group by locale, category, difficulty
order by locale, category, difficulty;

-- B. All catalog/allocator overloads and whether their source contains exact-locale checks.
select p.oid::regprocedure::text as signature,
       position('q.locale = v_locale' in pg_get_functiondef(p.oid)) > 0 as checks_exact_locale,
       position('LOCALE_QUESTION_BANK_EMPTY' in pg_get_functiondef(p.oid)) > 0 as has_locale_empty_error
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_quiz_catalog','allocate_unseen_quiz')
order by p.proname, signature;

-- C. Count eligible approved questions that have never been seen by any user.
-- This is a global inventory check, NOT a per-account quota.
select q.locale, q.category, count(*) as approved_total,
       count(*) filter (where not exists (
           select 1 from public.question_seen_history h where h.question_id = q.id
       )) as never_seen_by_anyone
from public.questions q
where q.review_status = 'approved'
group by q.locale, q.category
order by q.locale, q.category;
