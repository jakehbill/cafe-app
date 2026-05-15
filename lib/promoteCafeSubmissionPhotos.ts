import {
  CAFE_IMAGES_BUCKET,
  CAFE_USER_PHOTO_BUCKET,
  getCafeImagesPublicUrl,
  isUnusableCafePhotoImageUrl,
} from '@/lib/cafePhotoSubmissions';
import { supabase } from '@/lib/supabase';

export type SubmissionPhotoToPromote = {
  id: string;
  user_id: string;
  storage_path: string;
};

export type PromotedLiveCafePhoto = {
  submissionPhotoId: string;
  userId: string;
  storagePath: string;
  publicUrl: string;
  sortOrder: number;
};

function extensionFromStoragePath(path: string): string {
  const trimmed = path.trim().toLowerCase();
  const dot = trimmed.lastIndexOf('.');
  if (dot === -1) return 'jpg';
  const ext = trimmed.slice(dot + 1).replace(/[^a-z0-9]/g, '');
  return ext || 'jpg';
}

function contentTypeForExtension(extension: string): string {
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  return 'image/jpeg';
}

function buildLiveCafeImageStoragePath(cafeId: string, index: number, extension: string): string {
  const ext = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  return `cafes/${cafeId}/${Date.now()}-${index}.${ext}`;
}

/**
 * Copies a submission photo from private `cafe-user-photos` into public `cafe-images`
 * (same bucket/folder pattern as working editorial cafés on cards).
 */
async function copySubmissionPhotoToPublicCafeImages(params: {
  sourcePath: string;
  cafeId: string;
  index: number;
}): Promise<{ ok: true; storagePath: string; publicUrl: string } | { ok: false; error: string }> {
  const sourcePath = String(params.sourcePath ?? '').trim();
  if (!sourcePath) {
    return { ok: false, error: 'Missing source storage path.' };
  }

  const extension = extensionFromStoragePath(sourcePath);
  const destPath = buildLiveCafeImageStoragePath(params.cafeId, params.index, extension);

  const downloadRes = await supabase.storage.from(CAFE_USER_PHOTO_BUCKET).download(sourcePath);
  if (downloadRes.error || !downloadRes.data) {
    return {
      ok: false,
      error: downloadRes.error?.message ?? 'Could not download submission photo from storage.',
    };
  }

  const uploadRes = await supabase.storage.from(CAFE_IMAGES_BUCKET).upload(destPath, downloadRes.data, {
    contentType: contentTypeForExtension(extension),
    upsert: true,
  });
  if (uploadRes.error) {
    return {
      ok: false,
      error: uploadRes.error.message ?? 'Could not upload photo to public café images bucket.',
    };
  }

  const publicUrl = getCafeImagesPublicUrl(destPath);
  if (!publicUrl || isUnusableCafePhotoImageUrl(publicUrl)) {
    return { ok: false, error: 'Could not build a public image URL for the live café.' };
  }

  return { ok: true, storagePath: destPath, publicUrl };
}

/**
 * Promote moderator-selected submission photos into the live café image system:
 * - `cafes.image_urls` ← public HTTPS URLs (`cafe-images` bucket, like working cafés)
 * - `cafe_photos` rows ← same URLs + storage paths for the gallery resolver
 */
export async function promoteSubmissionPhotosToLiveCafe(params: {
  cafeId: string;
  photos: SubmissionPhotoToPromote[];
}): Promise<{
  imageUrls: string[];
  cafePhotoRows: Array<{
    cafe_id: number;
    user_id: string;
    storage_path: string;
    image_url: string;
    sort_order: number;
    status: 'approved';
  }>;
  errors: string[];
}> {
  const cafeId = String(params.cafeId ?? '').trim();
  const cafeIdNum = Number(cafeId);
  const imageUrls: string[] = [];
  const cafePhotoRows: Array<{
    cafe_id: number;
    user_id: string;
    storage_path: string;
    image_url: string;
    sort_order: number;
    status: 'approved';
  }> = [];
  const errors: string[] = [];

  if (!cafeId || !Number.isFinite(cafeIdNum)) {
    return { imageUrls, cafePhotoRows, errors: ['Invalid café id for photo promotion.'] };
  }

  for (let index = 0; index < params.photos.length; index += 1) {
    const photo = params.photos[index];
    const sourcePath = String(photo.storage_path ?? '').trim();
    const userId = String(photo.user_id ?? '').trim();
    if (!sourcePath || !userId) continue;

    const copied = await copySubmissionPhotoToPublicCafeImages({
      sourcePath,
      cafeId,
      index,
    });
    if (!copied.ok) {
      const message = copied.error;
      errors.push(message);
      console.error('[promoteSubmissionPhotosToLiveCafe] copy failed', {
        cafeId,
        sourcePath,
        message,
      });
      continue;
    }

    imageUrls.push(copied.publicUrl);
    cafePhotoRows.push({
      cafe_id: cafeIdNum,
      user_id: userId,
      storage_path: copied.storagePath,
      image_url: copied.publicUrl,
      sort_order: index,
      status: 'approved',
    });
  }

  return {
    imageUrls: Array.from(new Set(imageUrls)),
    cafePhotoRows,
    errors,
  };
}
