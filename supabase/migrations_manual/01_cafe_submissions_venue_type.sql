-- 01 — cafe_submissions.venue_type
-- Required by Suggest a Space / Google Places create flow.
-- Production probe (2026-07-20): column missing from PostgREST schema cache.
-- Safe to re-run.

alter table public.cafe_submissions
  add column if not exists venue_type text;

update public.cafe_submissions
set venue_type = 'cafe'
where venue_type is null or btrim(venue_type) = '';

comment on column public.cafe_submissions.venue_type is
  'Workspace type (cafe, coworking, hotel_lobby, …). Required on new submissions.';
