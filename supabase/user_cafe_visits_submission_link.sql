-- Run once in Supabase SQL Editor for projects that already have user_cafe_visits.
-- Lets visit logs point to pending cafe submissions until moderation approval.

alter table public.user_cafe_visits
  alter column cafe_id drop not null;

alter table public.user_cafe_visits
  add column if not exists submission_id uuid references public.cafe_submissions (id) on delete set null;

alter table public.user_cafe_visits
  add column if not exists updated_at timestamptz not null default now();

create index if not exists user_cafe_visits_submission_idx on public.user_cafe_visits (submission_id);
