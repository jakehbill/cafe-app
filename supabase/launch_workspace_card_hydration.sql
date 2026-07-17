-- Launch: hydrate public workspace cards from user_cafe_visits.
-- Run once in Supabase SQL Editor after workspace review columns exist.
--
-- Why: cards read cafe_public_scores + get_cafes_workspace_review_summaries,
-- NOT user_cafe_visits directly. Reviews can exist on visits while ratings /
-- the old scores view stay empty (e.g. after sprint6 reset, or RPC not deployed).
--
-- After this script:
--   • One visit with a Work Score → cafe_public_scores shows that score (not "New")
--   • Visit stay/cost/wifi/etc. → workspace fact modes via SECURITY DEFINER RPC
--   • Visit tags → community tag popularity via SECURITY DEFINER RPC

-- ---------------------------------------------------------------------------
-- 1) Public Work Score = latest visit rating per (user, cafe)
-- ---------------------------------------------------------------------------
drop view if exists public.cafe_public_scores cascade;

create view public.cafe_public_scores
with (security_invoker = false)
as
with latest_per_user as (
  select distinct on (v.user_id, v.cafe_id::text)
    v.cafe_id::text as cafe_id,
    v.rating
  from public.user_cafe_visits v
  where v.rating is not null
    and v.rating > 0
    and v.cafe_id is not null
    and length(trim(both from v.cafe_id::text)) > 0
  order by
    v.user_id,
    v.cafe_id::text,
    v.updated_at desc nulls last,
    v.created_at desc nulls last
)
select
  cafe_id,
  round(avg(rating::double precision)::numeric, 2)::double precision as public_coffee_score,
  count(*)::bigint as coffee_rating_count
from latest_per_user
group by cafe_id;

comment on view public.cafe_public_scores is
  'Public Work Score from latest user_cafe_visits.rating per user (1–10). security_invoker=false so anon/auth see community averages.';

grant select on public.cafe_public_scores to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) SECURITY DEFINER score RPC (fallback if view RLS/options misbehave)
-- ---------------------------------------------------------------------------
drop function if exists public.get_cafes_public_work_scores(text[]);

create function public.get_cafes_public_work_scores(p_cafe_ids text[] default null)
returns table (
  cafe_id text,
  public_coffee_score double precision,
  coffee_rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct trim(both from x) as cafe_id
    from unnest(coalesce(p_cafe_ids, '{}'::text[])) as x
    where length(trim(both from x)) > 0
  ),
  latest_per_user as (
    select distinct on (v.user_id, v.cafe_id::text)
      v.cafe_id::text as cafe_id,
      v.rating
    from public.user_cafe_visits v
    where v.rating is not null
      and v.rating > 0
      and v.cafe_id is not null
      and length(trim(both from v.cafe_id::text)) > 0
      and (
        p_cafe_ids is null
        or cardinality(p_cafe_ids) = 0
        or exists (
          select 1 from requested r where r.cafe_id = v.cafe_id::text
        )
      )
    order by
      v.user_id,
      v.cafe_id::text,
      v.updated_at desc nulls last,
      v.created_at desc nulls last
  )
  select
    l.cafe_id,
    round(avg(l.rating::double precision)::numeric, 2)::double precision as public_coffee_score,
    count(*)::bigint as coffee_rating_count
  from latest_per_user l
  group by l.cafe_id;
$$;

grant execute on function public.get_cafes_public_work_scores(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Workspace fact modes (stay / cost / seat / wifi / coffee / food)
-- ---------------------------------------------------------------------------
drop function if exists public.get_cafes_workspace_review_summaries(text[]);

create function public.get_cafes_workspace_review_summaries(p_cafe_ids text[])
returns table (
  cafe_id text,
  stay_duration text,
  cost_to_work text,
  busyness text,
  wifi_reliability text,
  coffee_quality text,
  food_quality text
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct trim(both from x) as cafe_id
    from unnest(coalesce(p_cafe_ids, '{}'::text[])) as x
    where length(trim(both from x)) > 0
  ),
  visits as (
    select
      coalesce(nullif(trim(c.id::text), ''), nullif(trim(v.cafe_id::text), '')) as cafe_id,
      nullif(trim(v.stay_duration), '') as stay_duration,
      nullif(trim(v.cost_to_work), '') as cost_to_work,
      nullif(trim(v.busyness), '') as busyness,
      nullif(trim(v.wifi_reliability), '') as wifi_reliability,
      nullif(trim(v.coffee_quality), '') as coffee_quality,
      nullif(trim(v.food_quality), '') as food_quality
    from public.user_cafe_visits v
    left join public.cafes c on c.id::text = v.cafe_id::text
    where v.cafe_id is not null
      and exists (
        select 1
        from requested r
        where r.cafe_id = v.cafe_id::text
           or r.cafe_id = c.id::text
           or nullif(trim(c.slug), '') = r.cafe_id
      )
  ),
  stay_mode as (
    select distinct on (cafe_id) cafe_id, stay_duration
    from (
      select cafe_id, stay_duration, count(*) as n
      from visits
      where stay_duration is not null
      group by cafe_id, stay_duration
    ) s
    order by cafe_id, n desc, stay_duration asc
  ),
  cost_mode as (
    select distinct on (cafe_id) cafe_id, cost_to_work
    from (
      select cafe_id, cost_to_work, count(*) as n
      from visits
      where cost_to_work is not null
      group by cafe_id, cost_to_work
    ) s
    order by cafe_id, n desc, cost_to_work asc
  ),
  seat_mode as (
    select distinct on (cafe_id) cafe_id, busyness
    from (
      select cafe_id, busyness, count(*) as n
      from visits
      where busyness is not null
      group by cafe_id, busyness
    ) s
    order by cafe_id, n desc, busyness asc
  ),
  wifi_mode as (
    select distinct on (cafe_id) cafe_id, wifi_reliability
    from (
      select cafe_id, wifi_reliability, count(*) as n
      from visits
      where wifi_reliability is not null
      group by cafe_id, wifi_reliability
    ) s
    order by cafe_id, n desc, wifi_reliability asc
  ),
  coffee_mode as (
    select distinct on (cafe_id) cafe_id, coffee_quality
    from (
      select cafe_id, coffee_quality, count(*) as n
      from visits
      where coffee_quality is not null
      group by cafe_id, coffee_quality
    ) s
    order by cafe_id, n desc, coffee_quality asc
  ),
  food_mode as (
    select distinct on (cafe_id) cafe_id, food_quality
    from (
      select cafe_id, food_quality, count(*) as n
      from visits
      where food_quality is not null
      group by cafe_id, food_quality
    ) s
    order by cafe_id, n desc, food_quality asc
  ),
  cafe_keys as (
    select distinct cafe_id from visits where cafe_id is not null
  )
  select
    k.cafe_id,
    st.stay_duration,
    co.cost_to_work,
    se.busyness,
    wi.wifi_reliability,
    cf.coffee_quality,
    fd.food_quality
  from cafe_keys k
  left join stay_mode st on st.cafe_id = k.cafe_id
  left join cost_mode co on co.cafe_id = k.cafe_id
  left join seat_mode se on se.cafe_id = k.cafe_id
  left join wifi_mode wi on wi.cafe_id = k.cafe_id
  left join coffee_mode cf on cf.cafe_id = k.cafe_id
  left join food_mode fd on fd.cafe_id = k.cafe_id;
$$;

grant execute on function public.get_cafes_workspace_review_summaries(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Community tags from visit.tags (not RLS-scoped ratings)
-- ---------------------------------------------------------------------------
drop function if exists public.get_cafes_tag_popularity(text[]);

create function public.get_cafes_tag_popularity(p_cafe_ids text[])
returns table (
  cafe_id text,
  tag text,
  n bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct trim(both from x) as cafe_id
    from unnest(coalesce(p_cafe_ids, '{}'::text[])) as x
    where length(trim(both from x)) > 0
  ),
  expanded as (
    select
      v.cafe_id::text as cafe_id,
      nullif(trim(both from t.tag), '') as tag
    from public.user_cafe_visits v
    cross join lateral unnest(coalesce(v.tags, '{}'::text[])) as t(tag)
    where v.cafe_id is not null
      and exists (
        select 1 from requested r where r.cafe_id = v.cafe_id::text
      )
  )
  select e.cafe_id, e.tag, count(*)::bigint as n
  from expanded e
  where e.tag is not null
  group by e.cafe_id, e.tag
  order by e.cafe_id, n desc, e.tag asc;
$$;

grant execute on function public.get_cafes_tag_popularity(text[]) to anon, authenticated;
