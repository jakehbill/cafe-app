-- Lightweight moderator-only Bulletin hiding (no new bulletin table).
--
-- REQUIRED: Run this entire file in Supabase SQL Editor.
-- Live audit (2026-05): production still had a legacy `get_recent_public_visit_notes`
-- that returns `id` (not `visit_id`), omits `hidden_from_bulletin`, and does not filter
-- hidden rows. `get_hidden_bulletin_entries` was not deployed. Until this file runs,
-- setting `user_cafe_visits.hidden_from_bulletin = true` has no effect on the Bulletin.
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
-- Drop first so return type can add `hidden_from_bulletin` when replacing an older signature.
drop function if exists public.get_recent_public_visit_notes(int);

create function public.get_recent_public_visit_notes(p_limit int default 5)
returns table (
  visit_id uuid,
  id uuid,
  cafe_id text,
  cafe_slug text,
  cafe_name text,
  cafe_area text,
  note text,
  created_at timestamptz,
  hidden_from_bulletin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id as visit_id,
    v.id as id,
    v.cafe_id::text as cafe_id,
    nullif(trim(c.slug), '') as cafe_slug,
    coalesce(nullif(trim(c.name), ''), 'Cafe') as cafe_name,
    nullif(trim(c.area), '') as cafe_area,
    trim(v.note) as note,
    v.created_at as created_at,
    coalesce(v.hidden_from_bulletin, false) as hidden_from_bulletin
  from public.user_cafe_visits v
  left join public.cafes c on c.id::text = v.cafe_id::text
  where v.cafe_id is not null
    and length(trim(coalesce(v.note, ''))) > 0
    -- Show when false or null; hide only when explicitly true.
    and v.hidden_from_bulletin is distinct from true
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 30));
$$;

grant execute on function public.get_recent_public_visit_notes(int) to anon, authenticated;

-- Authoritative hidden rows for client-side filtering when the deployed feed RPC is stale.
-- Returns only visits that are hidden but would otherwise qualify for the Bulletin.
drop function if exists public.get_hidden_bulletin_entries();

create function public.get_hidden_bulletin_entries()
returns table (
  visit_id uuid,
  cafe_id text,
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
    trim(v.note) as note,
    v.created_at as created_at
  from public.user_cafe_visits v
  where v.hidden_from_bulletin is true
    and v.cafe_id is not null
    and length(trim(coalesce(v.note, ''))) > 0;
$$;

grant execute on function public.get_hidden_bulletin_entries() to anon, authenticated;

