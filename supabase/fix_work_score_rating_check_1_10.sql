-- Fix Work Score storage: allow 1–10 on user_cafe_visits.rating
-- and public.ratings.coffee_rating.
--
-- Safe to re-run. Drops cafe_public_scores temporarily so coffee_rating can be widened
-- (Postgres: cannot alter a column used by a view).

-- ---------------------------------------------------------------------------
-- user_cafe_visits.rating
-- ---------------------------------------------------------------------------
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
  drop constraint if exists user_cafe_visits_rating_check;

alter table public.user_cafe_visits
  add constraint user_cafe_visits_rating_check
  check (rating is null or (rating >= 1 and rating <= 10));

comment on column public.user_cafe_visits.rating is
  'Work Score 1–10 (integers). Synced to public.ratings.coffee_rating.';

-- ---------------------------------------------------------------------------
-- public.ratings.coffee_rating (depends on cafe_public_scores view)
-- ---------------------------------------------------------------------------
drop view if exists public.cafe_public_scores;

alter table public.ratings
  drop constraint if exists ratings_coffee_rating_check;

alter table public.ratings
  alter column coffee_rating type numeric(4, 1)
  using (
    case
      when coffee_rating is null then null
      else round(coffee_rating::numeric)
    end
  );

alter table public.ratings
  drop constraint if exists ratings_coffee_rating_check;

alter table public.ratings
  add constraint ratings_coffee_rating_check
  check (coffee_rating is null or (coffee_rating >= 1 and coffee_rating <= 10));

-- Recreate public aggregate view (Work Score 1–10 averages)
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
  'Public Work Score aggregate per cafe (coffee_rating 1–10). Runs as view owner so averages include all users.';

grant select on public.cafe_public_scores to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Legacy personal cache
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_cafe_ratings' and column_name = 'coffee'
  ) then
    alter table public.user_cafe_ratings drop constraint if exists user_cafe_ratings_coffee_check;
    alter table public.user_cafe_ratings
      alter column coffee type numeric(4, 1)
      using (
        case
          when coffee is null then null
          else round(coffee::numeric)
        end
      );
  end if;
end $$;
