-- Canonical public coffee score per cafe (aggregated from user coffee ratings only).
-- Run in Supabase SQL Editor after `public.ratings` exists.
--
-- Columns match what the app expects:
--   cafe_id              — text, matches public.cafes.id
--   public_coffee_score  — average of coffee_rating (1–5 scale)
--   coffee_rating_count  — number of ratings contributing to the average
--
-- security_invoker = false: aggregate all rows in public.ratings (RLS on ratings is per-user).
-- Without this, each user only sees their own rating in the average (always looks like 5.0).

create or replace view public.cafe_public_scores
with (security_invoker = false)
as
select
  cafe_id::text as cafe_id,
  round(avg(coffee_rating::double precision)::numeric, 2)::double precision as public_coffee_score,
  count(*)::bigint as coffee_rating_count
from public.ratings
where coffee_rating is not null
  and coffee_rating > 0
group by cafe_id;

comment on view public.cafe_public_scores is
  'Public coffee aggregate per cafe; coffee_rating only. Runs as view owner so averages include all users.';

grant select on public.cafe_public_scores to anon, authenticated;
