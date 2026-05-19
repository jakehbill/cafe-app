-- Beaned Bulletin public feed + moderator queue (security definer).
-- Run in Supabase SQL Editor after bulletin_items_setup.sql.

-- Extend allowed statuses if needed
alter table public.bulletin_items drop constraint if exists bulletin_items_status_check;
alter table public.bulletin_items
  add constraint bulletin_items_status_check
  check (status in ('pending', 'approved', 'published', 'visible', 'hidden', 'rejected', 'spam'));

drop policy if exists "bulletin_items_select_visible" on public.bulletin_items;
create policy "bulletin_items_select_visible"
  on public.bulletin_items for select
  using (
    status is null
    or status in ('visible', 'pending', 'approved', 'published')
  );

create or replace function public.is_bulletin_status_public(p_status text)
returns boolean
language sql
immutable
as $$
  select
    p_status is null
    or p_status in ('visible', 'pending', 'approved', 'published');
$$;

-- Recent notes for home Bulletin (visits + optional bulletin_items overlay)
create or replace function public.get_recent_bulletin_feed(p_limit int default 5)
returns table (
  row_key text,
  bulletin_id uuid,
  source_visit_id uuid,
  cafe_id text,
  cafe_name text,
  cafe_area text,
  note text,
  created_at timestamptz,
  item_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(b.id::text, v.id::text) as row_key,
    b.id as bulletin_id,
    v.id as source_visit_id,
    trim(v.cafe_id::text) as cafe_id,
    coalesce(nullif(trim(c.name), ''), 'Cafe') as cafe_name,
    nullif(trim(c.area), '') as cafe_area,
    coalesce(
      nullif(trim(b.display_text), ''),
      nullif(trim(b.original_text), ''),
      nullif(trim(v.note), '')
    ) as note,
    coalesce(b.created_at, v.created_at) as created_at,
    coalesce(b.status, 'visible') as item_status
  from public.user_cafe_visits v
  left join public.bulletin_items b on b.source_visit_id = v.id
  left join public.cafes c on c.id::text = trim(v.cafe_id::text)
  where v.cafe_id is not null
    and length(trim(coalesce(v.note, ''))) > 0
    and public.is_bulletin_status_public(b.status)
  order by coalesce(b.created_at, v.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

grant execute on function public.get_recent_bulletin_feed(int) to anon, authenticated;

-- Moderator: all visit notes with bulletin status (for hide / restore)
create or replace function public.get_bulletin_moderation_feed()
returns table (
  row_key text,
  bulletin_id uuid,
  source_visit_id uuid,
  cafe_id text,
  cafe_name text,
  cafe_area text,
  original_text text,
  display_text text,
  bulletin_text text,
  item_status text,
  created_at timestamptz,
  user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(b.id::text, v.id::text) as row_key,
    b.id as bulletin_id,
    v.id as source_visit_id,
    trim(v.cafe_id::text) as cafe_id,
    coalesce(nullif(trim(c.name), ''), 'Cafe') as cafe_name,
    nullif(trim(c.area), '') as cafe_area,
    trim(coalesce(v.note, '')) as original_text,
    coalesce(nullif(trim(b.display_text), ''), nullif(trim(b.original_text), ''), trim(coalesce(v.note, ''))) as display_text,
    coalesce(
      nullif(trim(b.display_text), ''),
      nullif(trim(b.original_text), ''),
      nullif(trim(v.note), '')
    ) as bulletin_text,
    coalesce(b.status, 'visible') as item_status,
    coalesce(b.created_at, v.created_at) as created_at,
    v.user_id
  from public.user_cafe_visits v
  left join public.bulletin_items b on b.source_visit_id = v.id
  left join public.cafes c on c.id::text = trim(v.cafe_id::text)
  where v.cafe_id is not null
    and length(trim(coalesce(v.note, ''))) > 0
  order by coalesce(b.created_at, v.created_at) desc
  limit 200;
$$;

grant execute on function public.get_bulletin_moderation_feed() to authenticated;

drop policy if exists "bulletin_items_insert_moderator" on public.bulletin_items;
create policy "bulletin_items_insert_moderator"
  on public.bulletin_items for insert
  with check (public.is_beaned_moderator());
