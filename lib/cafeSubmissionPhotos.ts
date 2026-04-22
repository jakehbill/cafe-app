import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

const CAFE_USER_PHOTO_BUCKET = 'cafe-user-photos';

type UploadableImageAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

type SubmissionPhotoKind = 'exterior' | 'coffee' | 'other';

export type SubmissionPhotoUploadInput = {
  userId: string;
  submissionId: string;
  images: UploadableImageAsset[];
};

function safeFileExtension(asset: UploadableImageAsset): string {
  const fromMime = asset.mimeType?.toLowerCase().trim();
  if (fromMime === 'image/png') return 'png';
  if (fromMime === 'image/webp') return 'webp';
  if (fromMime === 'image/heic' || fromMime === 'image/heif') return 'heic';
  const fromName = asset.fileName?.toLowerCase().trim() ?? '';
  if (fromName.includes('.')) {
    const ext = fromName.split('.').pop();
    if (ext && ext.length <= 5) return ext.replace(/[^a-z0-9]/g, '') || 'jpg';
  }
  return 'jpg';
}

function safeContentType(asset: UploadableImageAsset, extension: string): string {
  const mime = asset.mimeType?.trim().toLowerCase();
  if (mime) return mime;
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  return 'image/jpeg';
}

function photoKindForIndex(index: number): SubmissionPhotoKind {
  if (index === 0) return 'exterior';
  if (index === 1) return 'coffee';
  return 'other';
}

export async function uploadSubmissionPhotos(
  input: SubmissionPhotoUploadInput
): Promise<{ uploadedCount: number; failedCount: number }> {
  let uploadedCount = 0;
  let failedCount = 0;

  for (let index = 0; index < input.images.length; index += 1) {
    const asset = input.images[index];
    try {
      const extension = safeFileExtension(asset);
      const contentType = safeContentType(asset, extension);
      const storagePath = `submission-photos/${input.userId}/${input.submissionId}/${Date.now()}-${index}.jpg`;

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64 || base64.length === 0) {
        throw new Error('Image data was empty.');
      }

      const arrayBuffer = decode(base64);
      const uploadRes = await supabase.storage
        .from(CAFE_USER_PHOTO_BUCKET)
        .upload(storagePath, arrayBuffer, { contentType, upsert: false });
      if (uploadRes.error) {
        throw new Error(uploadRes.error.message);
      }

      const insertRes = await supabase.from('cafe_submission_photos').insert({
        submission_id: input.submissionId,
        user_id: input.userId,
        storage_path: storagePath,
        image_url: null,
        photo_kind: photoKindForIndex(index),
        sort_order: index,
      });
      if (insertRes.error) {
        throw new Error(insertRes.error.message);
      }

      uploadedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.warn(
        '[uploadSubmissionPhotos] photo upload failed',
        error instanceof Error ? error.message : error
      );
    }
  }

  return { uploadedCount, failedCount };
}

