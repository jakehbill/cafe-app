import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import type { Cafe } from '@/data/cafes';
import { supabase, type SupabaseActionResult } from '@/lib/supabase';

export type UploadableImageAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export const CAFE_USER_PHOTO_BUCKET = 'cafe-user-photos';

/** Public bucket used for live café card/detail images (same as placeholder + editorial cafés). */
export const CAFE_IMAGES_BUCKET = 'cafe-images';

export function getCafeImagesPublicUrl(storagePath: string): string {
  const path = String(storagePath ?? '').trim();
  if (!path) return '';
  return supabase.storage.from(CAFE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl ?? '';
}

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

export function buildCafePhotoStoragePath(params: {
  userId: string;
  cafeId: string;
  timestampMs?: number;
  extension?: string;
}): string {
  const extension = (params.extension ?? 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const ts = params.timestampMs ?? Date.now();
  return `${params.userId}/${params.cafeId}/${ts}.${extension}`;
}

/** Shared storage upload for café photos, submission photos, and visit photos (web + native). */
export async function uploadImageAssetToStorageBucket(params: {
  asset: UploadableImageAsset;
  storagePath: string;
  logTag?: string;
}): Promise<{ ok: true; contentType: string } | { ok: false; error: string }> {
  const extension = safeFileExtension(params.asset);
  const contentType = safeContentType(params.asset, extension);
  const logTag = params.logTag ?? 'uploadImageAssetToStorageBucket';

  try {
    let uploadResult:
      | { error: null }
      | {
          error: { message: string };
        };
    if (Platform.OS === 'web') {
      let blob: Blob;
      try {
        const response = await fetch(params.asset.uri);
        blob = await response.blob();
      } catch (error) {
        console.error(`[${logTag}] web blob conversion failed:`, error);
        throw new Error(
          `Failed to read selected image on web: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      if (!blob || blob.size === 0) {
        throw new Error('Selected image is empty (0 bytes). Please choose another image.');
      }
      uploadResult = await supabase.storage
        .from(CAFE_USER_PHOTO_BUCKET)
        .upload(params.storagePath, blob, {
          contentType,
          upsert: false,
        });
    } else {
      let base64 = '';
      try {
        base64 = await FileSystem.readAsStringAsync(params.asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (error) {
        throw new Error(
          `Failed to read selected image: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      if (!base64 || base64.length === 0) {
        throw new Error('Selected image could not be read.');
      }

      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = decode(base64);
      } catch (error) {
        throw new Error(
          `Failed to decode image data: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      uploadResult = await supabase.storage
        .from(CAFE_USER_PHOTO_BUCKET)
        .upload(params.storagePath, arrayBuffer, {
          contentType,
          upsert: false,
        });
    }

    if (uploadResult.error) {
      throw new Error(`Upload failed: ${uploadResult.error.message}`);
    }

    return { ok: true, contentType };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Photo upload failed.';
    console.error(`[${logTag}]`, message, error);
    return { ok: false, error: message };
  }
}

export async function uploadCafePhotoAssetToStorage(params: {
  userId: string;
  cafeId: string;
  asset: UploadableImageAsset;
}): Promise<
  | { ok: true; storagePath: string; contentType: string }
  | {
      ok: false;
      error: string;
    }
> {
  const extension = safeFileExtension(params.asset);
  const storagePath = buildCafePhotoStoragePath({
    userId: params.userId,
    cafeId: params.cafeId,
    extension,
  });

  const upload = await uploadImageAssetToStorageBucket({
    asset: params.asset,
    storagePath,
    logTag: 'uploadCafePhotoAssetToStorage',
  });
  if (!upload.ok) {
    return upload;
  }

  return { ok: true, storagePath, contentType: upload.contentType };
}

export async function submitCafePhoto(input: {
  cafeId: string;
  asset: UploadableImageAsset;
  caption?: string;
}): Promise<SupabaseActionResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false, error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to add a photo.' };
  }

  const cafeId = String(input.cafeId).trim();
  if (!cafeId) {
    return { ok: false, error: 'Cafe id is required.' };
  }

  try {
    const upload = await uploadCafePhotoAssetToStorage({
      userId,
      cafeId,
      asset: input.asset,
    });
    if (!upload.ok) {
      return upload;
    }
    const { storagePath } = upload;

    const insertRes = await supabase.from('cafe_photos').insert({
      user_id: userId,
      cafe_id: Number(cafeId),
      storage_path: storagePath,
      image_url: null,
      caption: input.caption?.trim() || null,
      status: 'pending',
    });

    if (insertRes.error) {
      throw new Error(`Database insert failed: ${insertRes.error.message}`);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Photo upload failed.',
    };
  }
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type CafePhotoRowForDisplay = {
  image_url?: string | null;
  storage_path?: string | null;
  sort_order?: number | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

/** `getPublicUrl` on the private `cafe-user-photos` bucket 403s — never use as a live image src. */
export function isUnusableCafePhotoImageUrl(url: unknown): boolean {
  const s = String(url ?? '').trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return true;
  if (lower.startsWith('blob:') || lower.startsWith('file:')) return true;
  if (/localhost|127\.0\.0\.1/i.test(s)) return true;
  if (!/^https?:\/\//i.test(s)) return true;
  if (/\/storage\/v1\/object\/public\/cafe-user-photos\//i.test(s)) return true;
  return false;
}

export function parseCafeIdForPhotoQuery(cafeId: string): number | string {
  const trimmed = String(cafeId ?? '').trim();
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

/** Normalized map key for `cafe.id` ↔ `cafe_photos.cafe_id` lookups. */
export function normalizeCafePhotoMapKey(cafeId: string | number): string {
  return String(cafeId ?? '').trim();
}

function uniquePublicImageUrls(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = String(raw ?? '').trim();
    if (!url || isUnusableCafePhotoImageUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Merge batch-loaded approved photo URLs onto café rows (catalog / list cards). */
export function mergeApprovedPhotosIntoCafes(
  cafes: Cafe[],
  approvedByCafeId: Map<string, string[]>
): Cafe[] {
  return cafes.map((cafe) => {
    const key = normalizeCafePhotoMapKey(cafe.id);
    const approved = approvedByCafeId.get(key) ?? [];
    if (approved.length > 0) {
      return { ...cafe, imageUrls: approved, imageUrl: approved[0] };
    }

    const fallback = uniquePublicImageUrls(
      cafe.imageUrls ?? (cafe.imageUrl ? [cafe.imageUrl] : [])
    );
    if (fallback.length > 0) {
      return { ...cafe, imageUrls: fallback, imageUrl: fallback[0] };
    }
    return { ...cafe, imageUrls: [], imageUrl: undefined };
  });
}

export async function resolveCafePhotoStoragePathToDisplayUrl(
  storagePath: string
): Promise<string | null> {
  const path = String(storagePath ?? '').trim();
  if (!path) return null;

  const signed = await supabase.storage
    .from(CAFE_USER_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signed.error) {
    console.warn('[resolveCafePhotoStoragePathToDisplayUrl] signed URL failed:', {
      path,
      message: signed.error.message,
    });
    return null;
  }
  const url = String(signed.data?.signedUrl ?? '').trim();
  return url.length > 0 ? url : null;
}

export async function resolveCafePhotoRowToDisplayUrl(
  row: CafePhotoRowForDisplay
): Promise<string | null> {
  const directUrl = String(row.image_url ?? '').trim();
  if (directUrl.length > 0 && !isUnusableCafePhotoImageUrl(directUrl)) {
    return directUrl;
  }

  const storagePath = String(row.storage_path ?? '').trim();
  if (!storagePath) return null;

  // Promoted / editorial live paths live in the public `cafe-images` bucket.
  if (storagePath.startsWith('cafes/')) {
    const publicUrl = getCafeImagesPublicUrl(storagePath);
    if (publicUrl.length > 0 && !isUnusableCafePhotoImageUrl(publicUrl)) {
      return publicUrl;
    }
  }

  // Legacy user uploads in private bucket (signed URL).
  if (storagePath.includes('submission-photos/')) {
    return resolveCafePhotoStoragePathToDisplayUrl(storagePath);
  }

  return resolveCafePhotoStoragePathToDisplayUrl(storagePath);
}

function sortCafePhotoRows<T extends CafePhotoRowForDisplay>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aPrimary = a.is_primary === true ? 1 : 0;
    const bPrimary = b.is_primary === true ? 1 : 0;
    if (aPrimary !== bPrimary) return bPrimary - aPrimary;

    const aOrder = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return aTime - bTime;
  });
}

export async function getApprovedCafePhotoUrls(cafeId: string): Promise<string[]> {
  const normalizedCafeId = String(cafeId).trim();
  if (!normalizedCafeId) return [];

  const res = await supabase
    .from('cafe_photos')
    .select('image_url, storage_path, sort_order, is_primary, created_at')
    .eq('cafe_id', parseCafeIdForPhotoQuery(normalizedCafeId))
    .eq('status', 'approved');

  if (res.error) {
    console.error('[getApprovedCafePhotoUrls] select failed:', res.error.message, {
      cafeId: normalizedCafeId,
    });
    return [];
  }

  const urls: string[] = [];
  for (const row of sortCafePhotoRows((res.data ?? []) as CafePhotoRowForDisplay[])) {
    const url = await resolveCafePhotoRowToDisplayUrl(row);
    if (url) urls.push(url);
  }

  return Array.from(new Set(urls));
}

/** Batch loader for café catalog cards (same resolver path as detail page). */
export async function fetchApprovedCafePhotoUrlsByCafeIds(
  cafeIds: string[]
): Promise<Map<string, string[]>> {
  const keys = Array.from(
    new Set(cafeIds.map((id) => normalizeCafePhotoMapKey(id)).filter((id) => id.length > 0))
  );
  if (keys.length === 0) return new Map();

  const keySet = new Set(keys);
  const numericKeys = keys.map((id) => Number(id)).filter((id) => Number.isFinite(id));

  const queries = [];
  if (numericKeys.length > 0) {
    queries.push(
      supabase
        .from('cafe_photos')
        .select('cafe_id, image_url, storage_path, sort_order, is_primary, created_at')
        .in('cafe_id', numericKeys)
        .eq('status', 'approved')
    );
  }
  if (keys.some((id) => !Number.isFinite(Number(id)))) {
    queries.push(
      supabase
        .from('cafe_photos')
        .select('cafe_id, image_url, storage_path, sort_order, is_primary, created_at')
        .in('cafe_id', keys)
        .eq('status', 'approved')
    );
  }

  const results = await Promise.all(queries);
  const rows: (CafePhotoRowForDisplay & { cafe_id: number | string })[] = [];
  for (const res of results) {
    if (res.error) {
      console.error('[fetchApprovedCafePhotoUrlsByCafeIds] select failed:', res.error.message);
      continue;
    }
    for (const row of res.data ?? []) {
      const cafeKey = normalizeCafePhotoMapKey((row as { cafe_id: number | string }).cafe_id);
      if (!keySet.has(cafeKey)) continue;
      rows.push(row as CafePhotoRowForDisplay & { cafe_id: number | string });
    }
  }

  const sorted = sortCafePhotoRows(rows);
  const mapped = await Promise.all(
    sorted.map(async (row) => {
      const cafeId = normalizeCafePhotoMapKey(row.cafe_id);
      if (!cafeId) return null;
      const url = await resolveCafePhotoRowToDisplayUrl(row);
      if (!url) return null;
      return { cafeId, url };
    })
  );

  const out = new Map<string, string[]>();
  for (const item of mapped) {
    if (!item) continue;
    const current = out.get(item.cafeId) ?? [];
    current.push(item.url);
    out.set(item.cafeId, current);
  }
  return out;
}