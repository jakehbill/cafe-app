-- Run once in Supabase: SQL Editor → paste → Run
-- One row per user + cafe. Tags are text only (e.g. "Quick"); scores are coffee / work / vibe only.

create table if not exists public.user_cafe_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  cafe_id text not null,
  coffee smallint not null default 0,
  work smallint not null default 0,
  vibe smallint not null default 0,
  tags text[] not null default '{}',
  notes text not null default '',
  primary key (user_id, cafe_id)
);

create index if not exists user_cafe_ratings_user_id_idx on public.user_cafe_ratings (user_id);

alter table public.user_cafe_ratings enable row level security;

create policy "user_cafe_ratings_select_own"
  on public.user_cafe_ratings for select
  using (auth.uid() = user_id);

create policy "user_cafe_ratings_insert_own"
  on public.user_cafe_ratings for insert
  with check (auth.uid() = user_id);

create policy "user_cafe_ratings_update_own"
  on public.user_cafe_ratings for update
  using (auth.uid() = user_id);

create policy "user_cafe_ratings_delete_own"
  on public.user_cafe_ratings for delete
  using (auth.uid() = user_id);
