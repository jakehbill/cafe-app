-- Run this in Supabase: SQL Editor → New query → Paste → Run
-- Creates per-user saved + visited cafe lists (no ratings).

-- Saved cafes (one row per user + cafe)
create table if not exists public.user_saved_cafes (
  user_id uuid not null references auth.users (id) on delete cascade,
  cafe_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);

-- Visited cafes (one row per user + cafe)
create table if not exists public.user_visited_cafes (
  user_id uuid not null references auth.users (id) on delete cascade,
  cafe_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);

create index if not exists user_saved_cafes_user_id_idx on public.user_saved_cafes (user_id);
create index if not exists user_visited_cafes_user_id_idx on public.user_visited_cafes (user_id);

alter table public.user_saved_cafes enable row level security;
alter table public.user_visited_cafes enable row level security;

-- Each user can only see and change their own rows (filtered by auth.uid()).
create policy "user_saved_cafes_select_own"
  on public.user_saved_cafes for select
  using (auth.uid() = user_id);

create policy "user_saved_cafes_insert_own"
  on public.user_saved_cafes for insert
  with check (auth.uid() = user_id);

create policy "user_saved_cafes_delete_own"
  on public.user_saved_cafes for delete
  using (auth.uid() = user_id);

create policy "user_visited_cafes_select_own"
  on public.user_visited_cafes for select
  using (auth.uid() = user_id);

create policy "user_visited_cafes_insert_own"
  on public.user_visited_cafes for insert
  with check (auth.uid() = user_id);

create policy "user_visited_cafes_delete_own"
  on public.user_visited_cafes for delete
  using (auth.uid() = user_id);
