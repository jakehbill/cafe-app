-- Allow authenticated users to upload into their own folder in cafe-user-photos.
-- Paths used by the app: `{userId}/{cafeOrSubmissionKey}/{timestamp}.ext`
-- and `submission-photos/{userId}/{submissionId}/...`
--
-- Run in Supabase SQL Editor if visit / submission photo uploads fail with
-- RLS / unauthorized errors (or cryptic "Load failed" after a failed request).

-- Ensure the bucket exists (no-op if already created in the dashboard).
insert into storage.buckets (id, name, public)
values ('cafe-user-photos', 'cafe-user-photos', false)
on conflict (id) do nothing;

drop policy if exists "cafe_user_photos_insert_own" on storage.objects;
create policy "cafe_user_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cafe-user-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'submission-photos'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "cafe_user_photos_update_own" on storage.objects;
create policy "cafe_user_photos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'cafe-user-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'submission-photos'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'cafe-user-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'submission-photos'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- Keep / restore read access for signed URLs (safe to re-run).
drop policy if exists "cafe_user_photos_select" on storage.objects;
create policy "cafe_user_photos_select"
  on storage.objects for select
  using (bucket_id = 'cafe-user-photos');
