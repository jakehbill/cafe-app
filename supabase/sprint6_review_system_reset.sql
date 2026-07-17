-- Sprint 6: Reset Beaned review system for the workspace review model.
-- Zero production users assumed — wipe all review-derived data.
--
-- PRESERVED: auth.users, profiles, cafes (incl. venue_type, is_certified, status,
--   editorial tags/images), user_saved_cafes, user_visited_cafes, visit rows,
--   visit_photos, cafe_photos.
--
-- CLEARED: ratings, rating_tags, user_cafe_ratings, bulletin_items (if present),
--   review fields on user_cafe_visits, submission review extras.
--
-- cafe_public_scores is a VIEW — becomes empty when ratings are deleted.
-- Apply in Supabase SQL editor, then ship app UI that shows "No Work Score yet".

begin;

-- 1) Child tags first
delete from public.rating_tags;

-- 2) Canonical public Work Score source (empties cafe_public_scores)
delete from public.ratings;

-- 3) Legacy personal rating cache
delete from public.user_cafe_ratings;

-- 4) Bulletin rows (optional table — skip if not deployed)
do $$
begin
  if to_regclass('public.bulletin_items') is not null then
    delete from public.bulletin_items;
  end if;
end $$;

-- 5) Clear review fields on visits; KEEP visit rows + photo columns
-- hidden_from_bulletin / is_public only if those columns exist
do $$
begin
  update public.user_cafe_visits
  set
    rating = null,
    tags = '{}'::text[],
    note = '',
    updated_at = now();

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'stay_duration'
  ) then
    update public.user_cafe_visits set stay_duration = null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'cost_to_work'
  ) then
    update public.user_cafe_visits set cost_to_work = null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'wifi_reliability'
  ) then
    update public.user_cafe_visits set wifi_reliability = null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'busyness'
  ) then
    update public.user_cafe_visits set busyness = null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'coffee_quality'
  ) then
    update public.user_cafe_visits set coffee_quality = null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'food_quality'
  ) then
    update public.user_cafe_visits set food_quality = null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'is_public'
  ) then
    update public.user_cafe_visits set is_public = false;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_visits' and column_name = 'hidden_from_bulletin'
  ) then
    update public.user_cafe_visits set hidden_from_bulletin = false;
  end if;
end $$;

-- 6) Suggest-flow review extras (spaces themselves stay).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cafe_submissions' and column_name = 'coffee_rating'
  ) then
    update public.cafe_submissions set coffee_rating = null where coffee_rating is not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cafe_submissions' and column_name = 'selected_tags'
  ) then
    update public.cafe_submissions set selected_tags = '{}'::text[] where selected_tags is not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cafe_submissions' and column_name = 'notes'
  ) then
    update public.cafe_submissions set notes = null where notes is not null;
  end if;
end $$;

commit;

-- Sanity
select 'ratings' as tbl, count(*)::bigint as n from public.ratings
union all
select 'rating_tags', count(*) from public.rating_tags
union all
select 'user_cafe_ratings', count(*) from public.user_cafe_ratings
union all
select 'visits_with_rating', count(*) from public.user_cafe_visits where rating is not null
union all
select 'cafe_public_scores', count(*) from public.cafe_public_scores;
