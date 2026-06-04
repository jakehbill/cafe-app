-- Optional: allow anonymous inserts into existing `beta_signups` (no schema change).
-- Run in Supabase SQL editor if `/join` submissions fail with RLS errors.

alter table public.beta_signups enable row level security;

drop policy if exists "anon_insert_beta_signups" on public.beta_signups;
create policy "anon_insert_beta_signups"
  on public.beta_signups
  for insert
  to anon, authenticated
  with check (true);
