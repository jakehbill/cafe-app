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

-- Visit logs (multiple rows per user + cafe)
create table if not exists public.user_cafe_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cafe_id text,
  submission_id uuid references public.cafe_submissions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rating numeric(2,1),
  tags text[] not null default '{}',
  note text not null default '',
  image_url text,
  storage_path text,
  is_public boolean not null default false
);

create index if not exists user_saved_cafes_user_id_idx on public.user_saved_cafes (user_id);
create index if not exists user_visited_cafes_user_id_idx on public.user_visited_cafes (user_id);
create index if not exists user_cafe_visits_user_id_idx on public.user_cafe_visits (user_id);
create index if not exists user_cafe_visits_user_created_idx
  on public.user_cafe_visits (user_id, created_at desc);
create index if not exists user_cafe_visits_submission_idx on public.user_cafe_visits (submission_id);

alter table public.user_saved_cafes enable row level security;
alter table public.user_visited_cafes enable row level security;
alter table public.user_cafe_visits enable row level security;

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

create policy "user_cafe_visits_select_own"
  on public.user_cafe_visits for select
  using (auth.uid() = user_id);

create policy "user_cafe_visits_insert_own"
  on public.user_cafe_visits for insert
  with check (auth.uid() = user_id);

create policy "user_cafe_visits_update_own"
  on public.user_cafe_visits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_cafe_visits_delete_own"
  on public.user_cafe_visits for delete
  using (auth.uid() = user_id);

alter table if exists public.cafe_photos
  add column if not exists source_visit_id uuid references public.user_cafe_visits (id) on delete set null;

create index if not exists cafe_photos_source_visit_idx on public.cafe_photos (source_visit_id);
