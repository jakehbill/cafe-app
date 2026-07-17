-- =============================================================================
-- Workspace review columns (product source of truth)
-- =============================================================================
-- Run AFTER review_model_final.sql (or on a DB that already has rating/tags/note).
-- Adds the optional + required workspace fields the Log Workspace UI saves.
--
-- Field → column map:
--   Work Session      → stay_duration
--   Seat Availability → busyness   (legacy name; values: difficult|okay|easy|plenty)
--   Wi-Fi             → wifi_reliability
--   Cost to Work      → cost_to_work
--   Coffee            → coffee_quality
--   Food              → food_quality
--   Work Score        → rating (already exists)
--   Tags              → tags (already exists)
--   Notes             → note (already exists)
--   Photos            → visit_photos (+ share_publicly; see visit_photos_share_publicly.sql)
-- =============================================================================

alter table public.user_cafe_visits add column if not exists stay_duration text;
alter table public.user_cafe_visits add column if not exists cost_to_work text;
alter table public.user_cafe_visits add column if not exists wifi_reliability text;
alter table public.user_cafe_visits add column if not exists busyness text;
alter table public.user_cafe_visits add column if not exists coffee_quality text;
alter table public.user_cafe_visits add column if not exists food_quality text;

comment on column public.user_cafe_visits.stay_duration is
  'Work Session: under_1h | 1_2h | half_day | full_day';
comment on column public.user_cafe_visits.cost_to_work is
  'Cost to Work: free | under_10 | 10_20 | 20_30 | 30_plus';
comment on column public.user_cafe_visits.wifi_reliability is
  'Wi-Fi: poor | okay | good | excellent';
comment on column public.user_cafe_visits.busyness is
  'Seat Availability: difficult | okay | easy | plenty';
comment on column public.user_cafe_visits.coffee_quality is
  'Coffee quality: poor | okay | good | excellent';
comment on column public.user_cafe_visits.food_quality is
  'Food quality: poor | okay | good | excellent';

-- Community Cost to work mode (SECURITY DEFINER — all users’ visits).
drop function if exists public.get_cafe_cost_to_work_summary(text);

create function public.get_cafe_cost_to_work_summary(p_cafe_id text)
returns table (
  cost_to_work text,
  mention_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with costs as (
    select trim(both from v.cost_to_work) as cost_to_work
    from public.user_cafe_visits v
    left join public.cafes c on c.id::text = v.cafe_id::text
    where length(trim(coalesce(p_cafe_id, ''))) > 0
      and v.cafe_id is not null
      and v.cost_to_work is not null
      and length(trim(v.cost_to_work)) > 0
      and (
        v.cafe_id::text = trim(p_cafe_id)
        or nullif(trim(c.slug), '') = trim(p_cafe_id)
      )
  ),
  counted as (
    select cost_to_work, count(*)::bigint as mention_count
    from costs
    group by cost_to_work
  )
  select cost_to_work, mention_count
  from counted
  order by mention_count desc, cost_to_work asc
  limit 1;
$$;

grant execute on function public.get_cafe_cost_to_work_summary(text) to anon, authenticated;

-- Also ensure Work Score 1–10 is allowed (fixes user_cafe_visits_rating_check on legacy 1–5 DBs).
-- Safe to re-run alongside fix_work_score_rating_check_1_10.sql.
alter table public.user_cafe_visits
  drop constraint if exists user_cafe_visits_rating_check;

alter table public.user_cafe_visits
  alter column rating type numeric(4, 1)
  using (
    case
      when rating is null then null
      else round(rating::numeric)
    end
  );

alter table public.user_cafe_visits
  add constraint user_cafe_visits_rating_check
  check (rating is null or (rating >= 1 and rating <= 10));
