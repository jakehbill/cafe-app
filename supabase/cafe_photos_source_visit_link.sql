-- Run once in Supabase SQL Editor for existing projects.
-- Links moderation photo rows back to originating visit logs.

alter table public.cafe_photos
  add column if not exists source_visit_id uuid references public.user_cafe_visits (id) on delete set null;

create index if not exists cafe_photos_source_visit_idx on public.cafe_photos (source_visit_id);
