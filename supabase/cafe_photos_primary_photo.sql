-- Primary café photo support (run if not already applied via cafe_photos_moderation.sql).
-- Ensures `is_primary` exists and optionally enforces one primary per approved café.

alter table public.cafe_photos
  add column if not exists is_primary boolean not null default false;

alter table public.cafe_photos
  add column if not exists sort_order integer;

-- Optional hard guarantee: only one primary row per café among approved photos.
create unique index if not exists cafe_photos_one_primary_per_cafe
  on public.cafe_photos (cafe_id)
  where is_primary = true and status = 'approved';
