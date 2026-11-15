create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  pi_uid text unique not null,
  display_name text,
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  locale text not null default 'en',
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  answer_index smallint not null check (answer_index between 0 and 3),
  explanation text not null,
  provenance text not null default 'ai-generated-original',
  review_status text not null default 'draft' check (review_status in ('draft','fact_checked','approved','rejected')),
  fact_check_notes text,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct boolean not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  created_at timestamptz not null default now()
);

create index if not exists questions_publish_idx on public.questions(locale, category, published_at desc) where review_status = 'approved';
create index if not exists attempts_profile_idx on public.quiz_attempts(profile_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;

-- Production policies must be added only after server-side Pi UID verification is implemented.
-- Do not expose answer_index to anonymous clients before an attempt is submitted.
