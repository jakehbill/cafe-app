-- Beaned Bulletin: visit notes are live by default; moderators hide only.
-- Run once in Supabase SQL Editor. Then run bulletin_items_auto_visible.sql if upgrading an older install.

create table if not exists public.bulletin_items (
  id uuid primary key default gen_random_uuid(),
  source_visit_id uuid not null references public.user_cafe_visits (id) on delete cascade,
  cafe_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  original_text text not null,
  display_text text not null,
  status text not null default 'visible'
    check (status in ('visible', 'pending', 'approved', 'published', 'hidden', 'rejected', 'spam')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null
);

create unique index if not exists bulletin_items_source_visit_id_key
  on public.bulletin_items (source_visit_id);

create index if not exists bulletin_items_status_created_idx
  on public.bulletin_items (status, created_at desc);

create index if not exists bulletin_items_visible_feed_idx
  on public.bulletin_items (created_at desc)
  where status in ('pending', 'approved', 'published');

alter table public.bulletin_items enable row level security;

-- Public home feed: visible items only
drop policy if exists "bulletin_items_select_approved" on public.bulletin_items;
drop policy if exists "bulletin_items_select_visible" on public.bulletin_items;
create policy "bulletin_items_select_visible"
  on public.bulletin_items for select
  using (status is null or status in ('visible', 'pending', 'approved', 'published'));

-- Visit owner can queue / refresh their own pending row
drop policy if exists "bulletin_items_insert_own" on public.bulletin_items;
create policy "bulletin_items_insert_own"
  on public.bulletin_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "bulletin_items_update_own_pending" on public.bulletin_items;
drop policy if exists "bulletin_items_update_own" on public.bulletin_items;
create policy "bulletin_items_update_own"
  on public.bulletin_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

drop policy if exists "bulletin_items_select_moderator" on public.bulletin_items;
create policy "bulletin_items_select_moderator"
  on public.bulletin_items for select
  using (public.is_beaned_moderator());

drop policy if exists "bulletin_items_update_moderator" on public.bulletin_items;
create policy "bulletin_items_update_moderator"
  on public.bulletin_items for update
  using (public.is_beaned_moderator())
  with check (public.is_beaned_moderator());

-- Optional: queue existing visit notes for curation (does not auto-publish)
-- insert into public.bulletin_items (source_visit_id, cafe_id, user_id, original_text, display_text, status, created_at)
-- select v.id, v.cafe_id, v.user_id, trim(v.note), trim(v.note), 'pending', v.created_at
-- from public.user_cafe_visits v
-- where v.cafe_id is not null
--   and length(trim(coalesce(v.note, ''))) > 0
-- on conflict (source_visit_id) do nothing;
