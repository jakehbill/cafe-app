-- Lightweight moderator-only Bulletin hiding (no new bulletin table).
--
-- What it does:
-- - Adds `hidden_from_bulletin` to `user_cafe_visits`
-- - Updates the existing RPC `get_recent_public_visit_notes` to exclude hidden items
-- - Exposes `visit_id` so the app can hide a specific item
-- - Adds a moderator-only UPDATE policy so moderators can hide/restore any visit
--
-- Run in Supabase SQL Editor.

alter table public.user_cafe_visits
  add column if not exists hidden_from_bulletin boolean not null default false;

-- Moderator allowlist (keep in sync with lib/moderator.ts MODERATOR_USER_IDS)
create or replace function public.is_beaned_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() in (
    '1f189db7-a89a-4239-85b6-0b3cdbddf1ed'::uuid
  );
$$;

-- Allow moderators to hide/restore any visit row (does not grant SELECT).
drop policy if exists "user_cafe_visits_update_moderator" on public.user_cafe_visits;
create policy "user_cafe_visits_update_moderator"
  on public.user_cafe_visits for update
  using (public.is_beaned_moderator())
  with check (public.is_beaned_moderator());

-- NOTE: This RPC existed before; we replace it so the home Bulletin can hide items.
-- It must be SECURITY DEFINER so it can read visit notes for public display.
create or replace function public.get_recent_public_visit_notes(p_limit int default 5)
returns table (
  visit_id uuid,
  cafe_id text,
  cafe_slug text,
  cafe_name text,
  cafe_area text,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id as visit_id,
    v.cafe_id::text as cafe_id,
    nullif(trim(c.slug), '') as cafe_slug,
    coalesce(nullif(trim(c.name), ''), 'Cafe') as cafe_name,
    nullif(trim(c.area), '') as cafe_area,
    trim(v.note) as note,
    v.created_at as created_at
  from public.user_cafe_visits v
  left join public.cafes c on c.id::text = v.cafe_id::text
  where v.cafe_id is not null
    and length(trim(coalesce(v.note, ''))) > 0
    and v.hidden_from_bulletin is distinct from true
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;

grant execute on function public.get_recent_public_visit_notes(int) to anon, authenticated;

