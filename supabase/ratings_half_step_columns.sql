-- Run once in Supabase SQL Editor if any rating column is still integer-only.
-- Beaned coffee ratings use 0.5 steps (1, 1.5, … 5) on a 1–5 scale.

-- Canonical public score (required for café cards / cafe_public_scores view)
alter table public.ratings
  alter column coffee_rating type numeric(2,1)
  using (
    case
      when coffee_rating is null then null
      else round(greatest(1, least(5, coffee_rating::numeric)) * 2) / 2
    end
  );

-- Google Places suggestion staging
alter table public.cafe_submissions
  add column if not exists coffee_rating numeric(2,1);

-- Visit logs (community notes + visit rating line)
-- Already numeric(2,1) in user_cafe_visits_setup.sql; safe no-op if already correct:
alter table public.user_cafe_visits
  alter column rating type numeric(2,1)
  using (
    case
      when rating is null then null
      else round(greatest(1, least(5, rating::numeric)) * 2) / 2
    end
  );

-- Legacy per-user cache used by CafeState (optional; primary source is public.ratings)
alter table public.user_cafe_ratings
  alter column coffee type numeric(2,1)
  using (
    case
      when coffee is null or coffee = 0 then 0
      when coffee > 5 then round(least(5, coffee::numeric / 2) * 2) / 2
      else round(greatest(1, least(5, coffee::numeric)) * 2) / 2
    end
  );
