-- DEPRECATED for launch: prefer supabase/launch_workspace_card_hydration.sql
-- which rebuilds cafe_public_scores from user_cafe_visits.rating (product source of truth).
--
-- Legacy definition (ratings.coffee_rating) kept for reference only — do not re-run
-- unless you intentionally want scores from public.ratings again.

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
  'LEGACY: ratings-backed Work Score. Launch uses visit-backed view in launch_workspace_card_hydration.sql.';

grant select on public.cafe_public_scores to anon, authenticated;
