-- 02 — cafes.google_place_id
-- Used by live-cafe duplicate detection when suggesting from Google Places.
-- Production probe (2026-07-20): column missing (app currently falls back to maps URL).
-- Safe to re-run. No auth.users FK.

alter table public.cafes
  add column if not exists google_place_id text;

create index if not exists cafes_google_place_id_idx
  on public.cafes (google_place_id)
  where google_place_id is not null;

comment on column public.cafes.google_place_id is
  'Google Place id (ChIJ…). Used to block duplicate live listings.';
