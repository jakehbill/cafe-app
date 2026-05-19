-- Moderator can read pending photos and approve/reject (keep in sync with lib/moderator.ts).
-- Run in Supabase SQL Editor if photo Approve appears to do nothing.

create or replace function public.is_beaned_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() in (
    '1f189db7-a89a-4239-85b6-0b3cdbddf1ed'::uuid
  );
$$;

alter table public.cafe_photos
  add column if not exists reviewed_at timestamptz;

alter table public.cafe_photos
  add column if not exists is_primary boolean not null default false;

alter table public.cafe_photos
  add column if not exists sort_order integer;

drop policy if exists "cafe_photos_select_moderator" on public.cafe_photos;
create policy "cafe_photos_select_moderator"
  on public.cafe_photos for select
  using (public.is_beaned_moderator());

drop policy if exists "cafe_photos_update_moderator" on public.cafe_photos;
create policy "cafe_photos_update_moderator"
  on public.cafe_photos for update
  using (public.is_beaned_moderator())
  with check (public.is_beaned_moderator());

drop policy if exists "cafes_update_moderator" on public.cafes;
create policy "cafes_update_moderator"
  on public.cafes for update
  using (public.is_beaned_moderator())
  with check (public.is_beaned_moderator());
