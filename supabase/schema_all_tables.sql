-- =============================================================================
-- Cafe app — full database setup (paste into Supabase → SQL Editor → Run)
-- =============================================================================
-- Creates 3 tables: saved cafes, visited cafes, ratings.
-- Each row belongs to one logged-in user (user_id = auth.users.id).
-- Row Level Security: users only see and change their own rows.
-- =============================================================================

-- Clean slate if you re-run (removes old tables from earlier versions of this app)
drop table if exists public.user_cafe_ratings cascade;
drop table if exists public.user_saved_cafes cascade;
drop table if exists public.user_visited_cafes cascade;

-- -----------------------------------------------------------------------------
-- 1) SAVED CAFES — which cafes the user bookmarked
-- -----------------------------------------------------------------------------
-- One row per (user, cafe). The UNIQUE constraint stops duplicate saves.

create table public.user_saved_cafes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cafe_id text not null,
  created_at timestamptz not null default now(),
  constraint user_saved_cafes_user_cafe_unique unique (user_id, cafe_id)
);

create index user_saved_cafes_user_id_idx on public.user_saved_cafes (user_id);

-- -----------------------------------------------------------------------------
-- 2) VISITED CAFES — which cafes the user marked as visited
-- -----------------------------------------------------------------------------
-- One row per (user, cafe). Same uniqueness idea as saved.

create table public.user_visited_cafes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cafe_id text not null,
  rank_position integer,
  created_at timestamptz not null default now(),
  constraint user_visited_cafes_user_cafe_unique unique (user_id, cafe_id)
);

create index user_visited_cafes_user_id_idx on public.user_visited_cafes (user_id);

-- -----------------------------------------------------------------------------
-- 3) RATINGS — user’s scores + tags + notes for a cafe
-- -----------------------------------------------------------------------------
-- "Quick" and similar words live in tags (text array), not as numeric scores.
-- Scores are coffee / work / vibe only.

create table public.user_cafe_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cafe_id text not null,
  coffee smallint not null default 0,
  work smallint not null default 0,
  vibe smallint not null default 0,
  tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint user_cafe_ratings_user_cafe_unique unique (user_id, cafe_id)
);

create index user_cafe_ratings_user_id_idx on public.user_cafe_ratings (user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- When RLS is ON, nobody can read/write unless a policy allows it.
-- These policies only allow the row owner (matching Supabase Auth user id).

alter table public.user_saved_cafes enable row level security;
alter table public.user_visited_cafes enable row level security;
alter table public.user_cafe_ratings enable row level security;

-- Saved cafes — own rows only
create policy "saved_select_own"
  on public.user_saved_cafes for select
  using (auth.uid() = user_id);

create policy "saved_insert_own"
  on public.user_saved_cafes for insert
  with check (auth.uid() = user_id);

create policy "saved_delete_own"
  on public.user_saved_cafes for delete
  using (auth.uid() = user_id);

-- (No UPDATE needed: app only inserts/deletes saved rows)

-- Visited cafes — own rows only
create policy "visited_select_own"
  on public.user_visited_cafes for select
  using (auth.uid() = user_id);

create policy "visited_insert_own"
  on public.user_visited_cafes for insert
  with check (auth.uid() = user_id);

create policy "visited_delete_own"
  on public.user_visited_cafes for delete
  using (auth.uid() = user_id);

create policy "visited_update_own"
  on public.user_visited_cafes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Ratings — own rows only (app uses upsert = insert + update)
create policy "ratings_select_own"
  on public.user_cafe_ratings for select
  using (auth.uid() = user_id);

create policy "ratings_insert_own"
  on public.user_cafe_ratings for insert
  with check (auth.uid() = user_id);

create policy "ratings_update_own"
  on public.user_cafe_ratings for update
  using (auth.uid() = user_id);

create policy "ratings_delete_own"
  on public.user_cafe_ratings for delete
  using (auth.uid() = user_id);
