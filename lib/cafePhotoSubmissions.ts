import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { supabase, type SupabaseActionResult } from '@/lib/supabase';

const CAFE_USER_PHOTO_BUCKET = 'cafe-user-photos';

type UploadableImageAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
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
  const contentType = safeContentType(params.asset, extension);
  const storagePath = buildCafePhotoStoragePath({
    userId: params.userId,
    cafeId: params.cafeId,
    extension,
  });

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
        console.error('[uploadCafePhotoAssetToStorage] web blob conversion failed:', error);
        throw new Error(
          `Failed to read selected image on web: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      if (!blob || blob.size === 0) {
        throw new Error('Selected image is empty (0 bytes). Please choose another image.');
      }
      uploadResult = await supabase.storage
        .from(CAFE_USER_PHOTO_BUCKET)
        .upload(storagePath, blob, {
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
        .upload(storagePath, arrayBuffer, {
          contentType,
          upsert: false,
        });
    }

    if (uploadResult.error) {
      throw new Error(`Upload failed: ${uploadResult.error.message}`);
    }

    return { ok: true, storagePath, contentType };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Photo upload failed.',
    };
  }
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

export async function getApprovedCafePhotoUrls(cafeId: string): Promise<string[]> {
  const normalizedCafeId = String(cafeId).trim();
  if (!normalizedCafeId) return [];

  const res = await supabase
    .from('cafe_photos')
    .select('image_url, storage_path')
    .eq('cafe_id', Number(normalizedCafeId))
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (res.error) {
    return [];
  }

  const urls: string[] = [];
  for (const row of res.data ?? []) {
    const imageUrl = typeof row.image_url === 'string' ? row.image_url.trim() : '';
    if (imageUrl.length > 0) {
      urls.push(imageUrl);
      continue;
    }

    const storagePath = typeof row.storage_path === 'string' ? row.storage_path.trim() : '';
    if (!storagePath) continue;

    const signed = await supabase.storage
      .from(CAFE_USER_PHOTO_BUCKET)
      .createSignedUrl(storagePath, 60 * 20);
    if (signed.error) {
      continue;
    }
    if (signed.data?.signedUrl) {
      urls.push(signed.data.signedUrl);
    }
  }

  return Array.from(new Set(urls));
}