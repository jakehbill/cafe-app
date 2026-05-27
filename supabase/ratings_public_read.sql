-- Optional: allow authenticated clients to read coffee_rating rows for debugging/tools.
-- Public cards use `cafe_public_scores` (security_invoker = false), not direct ratings SELECT.
-- Run after `public.ratings` exists.

alter table public.ratings enable row level security;

drop policy if exists "ratings_select_own" on public.ratings;
drop policy if exists "ratings_insert_own" on public.ratings;
drop policy if exists "ratings_update_own" on public.ratings;
drop policy if exists "ratings_delete_own" on public.ratings;

create policy "ratings_select_own"
  on public.ratings for select
  using (auth.uid() = user_id);

create policy "ratings_insert_own"
  on public.ratings for insert
  with check (auth.uid() = user_id);

create policy "ratings_update_own"
  on public.ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ratings_delete_own"
  on public.ratings for delete
  using (auth.uid() = user_id);
