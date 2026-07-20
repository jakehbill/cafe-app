-- 03 — cafe_photos primary / sort fields
-- Used by moderation primary-photo tools.
-- Production probe (2026-07-20): is_primary and sort_order missing.
-- Safe to re-run.

alter table public.cafe_photos
  add column if not exists is_primary boolean not null default false;

alter table public.cafe_photos
  add column if not exists sort_order integer;

comment on column public.cafe_photos.is_primary is
  'At most one approved primary photo per cafe (enforced in app / optional unique index later).';
comment on column public.cafe_photos.sort_order is
  'Display order within a cafe gallery.';
