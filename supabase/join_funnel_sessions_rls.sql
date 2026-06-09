-- RLS policies for public.join_funnel_sessions (required for client upserts).
-- Run in Supabase SQL editor if join_funnel_sessions stays empty while analytics_events works.

-- Upsert requires a unique session_id.
create unique index if not exists join_funnel_sessions_session_id_key
  on public.join_funnel_sessions (session_id);

alter table public.join_funnel_sessions enable row level security;

drop policy if exists "Allow public join funnel session select" on public.join_funnel_sessions;
create policy "Allow public join funnel session select"
on public.join_funnel_sessions
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public join funnel session insert" on public.join_funnel_sessions;
create policy "Allow public join funnel session insert"
on public.join_funnel_sessions
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public join funnel session update" on public.join_funnel_sessions;
create policy "Allow public join funnel session update"
on public.join_funnel_sessions
for update
to anon, authenticated
using (true)
with check (true);
