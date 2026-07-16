-- Sprint 4: remote-work review fields on visits + migrate Work Score to 1–10.
-- Apply in Supabase SQL editor before shipping the app update.

alter table public.user_cafe_visits add column if not exists stay_duration text;
alter table public.user_cafe_visits add column if not exists cost_to_work text;
alter table public.user_cafe_visits add column if not exists wifi_reliability text;
alter table public.user_cafe_visits add column if not exists busyness text;
alter table public.user_cafe_visits add column if not exists coffee_quality text;
alter table public.user_cafe_visits add column if not exists food_quality text;

comment on column public.user_cafe_visits.stay_duration is
  'How long the reviewer could comfortably work: under_1h | 1_2h | half_day | full_day';
comment on column public.user_cafe_visits.cost_to_work is
  'Realistic spend to work comfortably: free | under_10 | 10_20 | 20_30 | 30_plus';
comment on column public.user_cafe_visits.wifi_reliability is
  'Optional: excellent | good | okay | poor';
comment on column public.user_cafe_visits.busyness is
  'Optional seat finding: difficult | okay | easy | plenty';
comment on column public.user_cafe_visits.coffee_quality is
  'Optional: excellent | good | okay | poor';
comment on column public.user_cafe_visits.food_quality is
  'Optional: excellent | good | okay | poor';

-- Migrate legacy 1–5 Work Scores to 1–10 (full-point recommendation scale).
-- Safe only once: after first run values are > 5 so they are skipped.
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

update public.cafe_submissions
set coffee_rating = coffee_rating * 2
where coffee_rating is not null
  and coffee_rating > 0
  and coffee_rating <= 5;

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
