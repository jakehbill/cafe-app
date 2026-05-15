-- Run in Supabase SQL Editor if approved café photos do not appear on live cards.
-- Lets the app read approved rows and sign storage paths in bucket `cafe-user-photos`.

-- Table: approved café photos visible to signed-in and anon app users
drop policy if exists "cafe_photos_select_approved" on public.cafe_photos;
create policy "cafe_photos_select_approved"
  on public.cafe_photos for select
  using (status = 'approved');

-- Storage: allow read of objects in cafe-user-photos (required for createSignedUrl / downloads)
drop policy if exists "cafe_user_photos_select" on storage.objects;
create policy "cafe_user_photos_select"
  on storage.objects for select
  using (bucket_id = 'cafe-user-photos');
