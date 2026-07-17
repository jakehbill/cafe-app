-- Private-by-default visit photos with optional community sharing.
-- Run in Supabase SQL Editor after deploy.

-- Source of truth on the user's diary photo
alter table public.visit_photos
  add column if not exists share_publicly boolean not null default false;

-- Mirrored on moderation / public gallery rows
alter table public.cafe_photos
  add column if not exists share_publicly boolean not null default false;

-- Existing cafe_photos rows were created under the old auto-queue behaviour
update public.cafe_photos
set share_publicly = true
where share_publicly = false
  and (status in ('pending', 'approved', 'rejected') or source_visit_id is not null);

create index if not exists visit_photos_share_publicly_idx
  on public.visit_photos (visit_id)
  where share_publicly = true;

create index if not exists cafe_photos_public_gallery_idx
  on public.cafe_photos (cafe_id, status)
  where status = 'approved' and share_publicly = true;

create index if not exists cafe_photos_pending_shared_idx
  on public.cafe_photos (created_at desc)
  where status = 'pending' and share_publicly = true;

-- Public / anon gallery reads: approved AND explicitly shared
drop policy if exists "cafe_photos_select_approved" on public.cafe_photos;
create policy "cafe_photos_select_approved"
  on public.cafe_photos for select
  using (status = 'approved' and share_publicly = true);
