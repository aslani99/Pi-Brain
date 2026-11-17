-- Independent web research metadata for question quality and rarity.
-- Research never publishes a question; human approval remains mandatory.

alter table public.questions
  add column if not exists fact_check_status text not null default 'not_checked'
    check (fact_check_status in ('not_checked', 'supported', 'unsupported', 'uncertain')),
  add column if not exists fact_check_report jsonb not null default '{}'::jsonb,
  add column if not exists novelty_score smallint
    check (novelty_score between 0 and 100),
  add column if not exists novelty_notes text;

create index if not exists questions_research_queue_idx
  on public.questions(locale, category, difficulty, novelty_score)
  where review_status in ('draft', 'fact_checked');

comment on column public.questions.fact_check_status is
  'Automated web research verdict. This is evidence for human review, not publication approval.';
comment on column public.questions.fact_check_report is
  'Structured web research summary, citations, domains, model and timestamp for editor inspection.';
comment on column public.questions.novelty_score is
  'Estimated rarity of the underlying fact in common trivia content; not a guarantee of global uniqueness.';
