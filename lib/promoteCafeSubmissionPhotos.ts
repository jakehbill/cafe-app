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

function parseCafeRowImageUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x ?? '').trim())
      .filter((s) => s.length > 0 && !isUnusableCafePhotoImageUrl(s) && !s.includes('submission-photos/'));
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => String(x ?? '').trim())
          .filter((s) => s.length > 0 && !isUnusableCafePhotoImageUrl(s));
      }
    } catch {
      /* not JSON */
    }
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !isUnusableCafePhotoImageUrl(s));
  }
  return [];
}

/**
 * On moderator approval: copy private upload → public `cafe-images`, update row + `cafes.image_urls`.
 */
export async function promoteApprovedCafePhotoToLive(params: {
  photoId: string;
  setAsPrimary?: boolean;
}): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const photoId = String(params.photoId ?? '').trim();
  if (!photoId) {
    return { ok: false, error: 'Photo id is required.' };
  }

  const rowRes = await supabase
    .from('cafe_photos')
    .select('id, user_id, cafe_id, storage_path, image_url, status')
    .eq('id', photoId)
    .eq('status', 'pending')
    .maybeSingle();

  if (rowRes.error) {
    return { ok: false, error: rowRes.error.message };
  }
  const row = rowRes.data as {
    id: string;
    user_id: string;
    cafe_id: number | string;
    storage_path: string | null;
    image_url: string | null;
  } | null;
  if (!row) {
    return { ok: false, error: 'Pending photo not found or already reviewed.' };
  }

  const cafeId = String(row.cafe_id ?? '').trim();
  const cafeIdNum = Number(cafeId);
  if (!cafeId || !Number.isFinite(cafeIdNum)) {
    return { ok: false, error: 'Photo is missing a valid café id.' };
  }

  const sourcePath = String(row.storage_path ?? '').trim();
  if (!sourcePath) {
    return { ok: false, error: 'Photo is missing a storage path.' };
  }

  let publicUrl = String(row.image_url ?? '').trim();
  let liveStoragePath = sourcePath;

  const alreadyLive =
    sourcePath.startsWith('cafes/') && publicUrl.length > 0 && !isUnusableCafePhotoImageUrl(publicUrl);

  if (!alreadyLive) {
    const copied = await copySubmissionPhotoToPublicCafeImages({
      sourcePath,
      cafeId,
      index: Date.now(),
    });
    if (!copied.ok) {
      return { ok: false, error: copied.error };
    }
    publicUrl = copied.publicUrl;
    liveStoragePath = copied.storagePath;
  }

  const cafeRowRes = await supabase.from('cafes').select('image_urls').eq('id', cafeId).maybeSingle();
  if (cafeRowRes.error) {
    return { ok: false, error: cafeRowRes.error.message };
  }
  const cafeImageUrls = parseCafeRowImageUrls(cafeRowRes.data?.image_urls);

  const approvedRes = await supabase
    .from('cafe_photos')
    .select('id, image_url, storage_path, is_primary')
    .eq('cafe_id', cafeIdNum)
    .eq('status', 'approved');

  const approvedRows = (approvedRes.data ?? []) as {
    id: string;
    image_url: string | null;
    storage_path: string | null;
    is_primary: boolean | null;
  }[];

  const hasLivePrimary =
    cafeImageUrls.length > 0 ||
    approvedRows.some((photo) => {
      const url = String(photo.image_url ?? '').trim();
      const path = String(photo.storage_path ?? '').trim();
      return (
        photo.is_primary === true ||
        (url.length > 0 && !isUnusableCafePhotoImageUrl(url)) ||
        path.startsWith('cafes/')
      );
    });

  const shouldSetPrimary = params.setAsPrimary === true || !hasLivePrimary;

  if (shouldSetPrimary) {
    const clearPrimaryRes = await supabase
      .from('cafe_photos')
      .update({ is_primary: false })
      .eq('cafe_id', cafeIdNum)
      .neq('id', photoId);
    if (clearPrimaryRes.error) {
      console.warn('[promoteApprovedCafePhotoToLive] clear is_primary failed:', clearPrimaryRes.error.message);
    }
  }

  const sortOrder = shouldSetPrimary ? 0 : approvedRows.length;
  const now = new Date().toISOString();

  const baseApprovePayload = {
    status: 'approved' as const,
    reviewed_at: now,
    storage_path: liveStoragePath,
    image_url: publicUrl,
  };

  let photoUpdateRes = await supabase
    .from('cafe_photos')
    .update({
      ...baseApprovePayload,
      is_primary: shouldSetPrimary,
      sort_order: sortOrder,
    })
    .eq('id', photoId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (photoUpdateRes.error && /column|schema cache/i.test(photoUpdateRes.error.message)) {
    photoUpdateRes = await supabase
      .from('cafe_photos')
      .update(baseApprovePayload)
      .eq('id', photoId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
  }

  if (photoUpdateRes.error) {
    return { ok: false, error: photoUpdateRes.error.message };
  }
  if (!photoUpdateRes.data?.id) {
    return {
      ok: false,
      error:
        'Photo could not be marked approved. It may already be reviewed, or moderator database permissions are missing.',
    };
  }

  let nextImageUrls: string[];
  if (shouldSetPrimary) {
    nextImageUrls = [publicUrl, ...cafeImageUrls.filter((url) => url !== publicUrl)];
  } else {
    nextImageUrls = cafeImageUrls.includes(publicUrl) ? cafeImageUrls : [...cafeImageUrls, publicUrl];
  }

  const cafeUpdateRes = await supabase.from('cafes').update({ image_urls: nextImageUrls }).eq('id', cafeId);
  if (cafeUpdateRes.error) {
    console.warn('[promoteApprovedCafePhotoToLive] cafes.image_urls update failed:', cafeUpdateRes.error.message);
  }

  return { ok: true, publicUrl };
}
