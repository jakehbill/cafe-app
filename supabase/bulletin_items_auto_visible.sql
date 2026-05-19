-- Beaned Bulletin: notes are live by default; moderators hide only.
-- Run in Supabase SQL Editor after bulletin_items_setup.sql.

alter table public.bulletin_items drop constraint if exists bulletin_items_status_check;

alter table public.bulletin_items
  alter column status set default 'published';

alter table public.bulletin_items
  add constraint bulletin_items_status_check
  check (status in ('visible', 'pending', 'approved', 'published', 'hidden', 'rejected', 'spam'));

-- Existing rows become visible on the home feed
update public.bulletin_items
set status = 'visible', updated_at = now()
where status in ('pending', 'approved', 'published');

drop policy if exists "bulletin_items_select_approved" on public.bulletin_items;
drop policy if exists "bulletin_items_select_visible" on public.bulletin_items;
create policy "bulletin_items_select_visible"
  on public.bulletin_items for select
  using (status is null or status in ('visible', 'pending', 'approved', 'published'));

drop index if exists bulletin_items_approved_feed_idx;
create index if not exists bulletin_items_visible_feed_idx
  on public.bulletin_items (created_at desc)
  where status in ('visible', 'pending', 'approved', 'published');
