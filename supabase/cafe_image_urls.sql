-- Optional: multiple photos per cafe (ordered; first = primary for list cards).
-- Run in Supabase SQL Editor when your `public.cafes` table is ready.
-- The app already reads `image_urls` when present; single `image_url` / `photo_url` still works alone.

-- alter table public.cafes
--   add column if not exists image_urls text[];

-- comment on column public.cafes.image_urls is
--   'Ordered photo URLs; first is primary for cards. If null/empty, use image_url.';
