-- Run in Supabase SQL editor if first_name / last_name are not on public.profiles yet.
alter table public.profiles
add column if not exists first_name text,
add column if not exists last_name text;
