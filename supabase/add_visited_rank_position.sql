-- Run once in Supabase SQL Editor (existing projects that already have user_visited_cafes).
-- Adds personal visit ordering for the Visited screen (1 = favorite).

alter table public.user_visited_cafes
  add column if not exists rank_position integer;

-- Allow users to update rank on their own visit rows (reordering).
drop policy if exists "visited_update_own" on public.user_visited_cafes;

create policy "visited_update_own"
  on public.user_visited_cafes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
