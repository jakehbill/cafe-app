-- Community tag insight for café detail (SECURITY DEFINER — all users' visit tag picks).
-- Source: user_cafe_visits.tags (log/rate flow), not curated cafes.tags.
-- Denominator: distinct users with ≥1 tag on a visit. Numerator: distinct users who picked the top tag.
-- Run in Supabase SQL Editor.

drop function if exists public.get_cafe_community_tag_insight(text);

create function public.get_cafe_community_tag_insight(p_cafe_id text)
returns table (
  tag text,
  mention_count bigint,
  total_tagged_users bigint,
  total_tagged_visits bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with tagged as (
    select
      v.id as visit_id,
      v.user_id,
      trim(both from t.tag) as tag
    from public.user_cafe_visits v
    cross join lateral unnest(coalesce(v.tags, '{}'::text[])) as t(tag)
    left join public.cafes c on c.id::text = v.cafe_id::text
    where length(trim(coalesce(p_cafe_id, ''))) > 0
      and v.cafe_id is not null
      and (
        v.cafe_id::text = trim(p_cafe_id)
        or nullif(trim(c.slug), '') = trim(p_cafe_id)
      )
      and length(trim(coalesce(t.tag, ''))) > 0
  ),
  totals as (
    select
      count(distinct visit_id)::bigint as total_tagged_visits,
      count(distinct user_id)::bigint as total_tagged_users
    from tagged
  ),
  by_tag as (
    select
      tag,
      count(distinct user_id)::bigint as mention_count
    from tagged
    group by tag
  )
  select
    b.tag,
    b.mention_count,
    t.total_tagged_users,
    t.total_tagged_visits
  from by_tag b
  cross join totals t
  where t.total_tagged_users > 0
  order by b.mention_count desc, b.tag asc
  limit 1;
$$;

grant execute on function public.get_cafe_community_tag_insight(text) to anon, authenticated;
