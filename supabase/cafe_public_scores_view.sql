-- Canonical public coffee score per cafe (aggregated from user coffee ratings only).
-- Run in Supabase SQL Editor after `public.ratings` exists.
--
-- Columns match what the app expects:
--   cafe_id              — text, matches public.cafes.id
--   public_coffee_score  — average of coffee_rating (same numeric scale as ratings.coffee_rating)
--   coffee_rating_count  — number of ratings contributing to the average

create or replace view public.cafe_public_scores as
select
  cafe_id::text as cafe_id,
  avg(coffee_rating::double precision) as public_coffee_score,
  count(*)::bigint as coffee_rating_count
from public.ratings
where coffee_rating is not null
  and coffee_rating > 0
group by cafe_id;

comment on view public.cafe_public_scores is
  'Public coffee aggregate per cafe; coffee_rating only (no work/vibe).';

grant select on public.cafe_public_scores to anon, authenticated;
