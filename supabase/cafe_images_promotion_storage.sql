-- Run in Supabase SQL Editor so moderation approval can copy submission photos
-- from private `cafe-user-photos` into public `cafe-images` (working card format).

-- Read submission uploads (moderator approval flow downloads these paths)
drop policy if exists "cafe_user_photos_select" on storage.objects;
create policy "cafe_user_photos_select"
  on storage.objects for select
  using (bucket_id = 'cafe-user-photos');

-- Write live café images (paths like cafes/{cafe_id}/{timestamp}-{index}.jpg)
drop policy if exists "cafe_images_insert_authenticated" on storage.objects;
create policy "cafe_images_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cafe-images');

drop policy if exists "cafe_images_update_authenticated" on storage.objects;
create policy "cafe_images_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'cafe-images');

-- Public read for cards (bucket should be public in Storage settings)
drop policy if exists "cafe_images_select_public" on storage.objects;
create policy "cafe_images_select_public"
  on storage.objects for select
  using (bucket_id = 'cafe-images');
