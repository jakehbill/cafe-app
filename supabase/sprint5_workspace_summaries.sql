-- Sprint 5: batch community workspace review modes for cards + detail.
-- Modes from user_cafe_visits (SECURITY DEFINER). Apply in Supabase SQL editor.

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
