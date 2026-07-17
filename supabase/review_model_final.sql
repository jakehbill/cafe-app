-- =============================================================================
-- Core review columns + Work Score 1–10 scale (already applied on production)
-- =============================================================================
-- Next: run supabase/workspace_review_columns.sql for stay/wifi/seat/cost/quality.
-- Photos sharing: supabase/visit_photos_share_publicly.sql
-- Supersedes: supabase/sprint4_work_review_fields.sql
--
-- Core fields:
--   user_cafe_visits.rating   → Work Score (1–10)
--   user_cafe_visits.tags     → workspace tags
--   user_cafe_visits.note     → notes
-- =============================================================================

-- Ensure core review columns exist (idempotent for older DBs).
alter table public.user_cafe_visits
  add column if not exists rating numeric(4, 1);

alter table public.user_cafe_visits
  add column if not exists tags text[] not null default '{}';

alter table public.user_cafe_visits
  add column if not exists note text not null default '';

alter table public.user_cafe_visits
  add column if not exists is_public boolean not null default false;

alter table public.user_cafe_visits
  add column if not exists updated_at timestamptz not null default now();

comment on column public.user_cafe_visits.rating is
  'Work Score 1–10 (workspace review model). Synced to public.ratings.coffee_rating.';
comment on column public.user_cafe_visits.tags is
  'Workspace review tags (slug array), e.g. quiet, good_wifi.';
comment on column public.user_cafe_visits.note is
  'Optional personal / community note from the log-workspace flow.';

-- -----------------------------------------------------------------------------
-- One-time Work Score scale: legacy 1–5 → 1–10
-- Safe: only doubles values still in (0, 5]. Skips rows already on 1–10.
-- -----------------------------------------------------------------------------
update public.ratings
set coffee_rating = coffee_rating * 2
where coffee_rating is not null
  and coffee_rating > 0
  and coffee_rating <= 5;

update public.user_cafe_visits
set rating = rating * 2
where rating is not null
  and rating > 0
  and rating <= 5;

update public.user_cafe_ratings
set coffee = coffee * 2
where coffee is not null
  and coffee > 0
  and coffee <= 5;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cafe_submissions'
      and column_name = 'coffee_rating'
  ) then
    update public.cafe_submissions
    set coffee_rating = coffee_rating * 2
    where coffee_rating is not null
      and coffee_rating > 0
      and coffee_rating <= 5;
  end if;
end $$;
