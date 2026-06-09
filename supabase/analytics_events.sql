-- Lightweight funnel analytics for public lead pages and `/join`.
-- Run in Supabase SQL editor if the table does not exist yet.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  event_name text not null,
  session_id text,
  source text,
  page_slug text,
  step_key text,
  metadata jsonb default '{}'::jsonb
);

alter table public.analytics_events enable row level security;

drop policy if exists "Allow public analytics event inserts" on public.analytics_events;
create policy "Allow public analytics event inserts"
on public.analytics_events
for insert
to anon, authenticated
with check (true);
