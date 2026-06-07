import { MAX_VISIT_PHOTOS } from '@/lib/visitPhotoLimits';
import { supabase } from '@/lib/supabase';
import {
  CAFE_USER_PHOTO_BUCKET,
  type UploadableImageAsset,
  uploadImageAssetToStorageBucket,
} from '@/lib/cafePhotoSubmissions';

type SubmissionPhotoKind = 'exterior' | 'coffee' | 'other';

export type SubmissionPhotoUploadInput = {
  userId: string;
  submissionId: string;
  images: UploadableImageAsset[];
};

export type SubmissionPhotoUploadResult = {
  uploadedCount: number;
  failedCount: number;
  errors: string[];
};

function photoKindForIndex(index: number): SubmissionPhotoKind {
  if (index === 0) return 'exterior';
  if (index === 1) return 'coffee';
  return 'other';
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

function buildSubmissionPhotoStoragePath(params: {
  userId: string;
  submissionId: string;
  index: number;
  extension: string;
}): string {
  const ext = params.extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  return `submission-photos/${params.userId}/${params.submissionId}/${Date.now()}-${params.index}.${ext}`;
}

export async function uploadSubmissionPhotos(
  input: SubmissionPhotoUploadInput
): Promise<SubmissionPhotoUploadResult> {
  let uploadedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  const images = input.images.slice(0, MAX_VISIT_PHOTOS);
  for (let index = 0; index < images.length; index += 1) {
    const asset = images[index];
    const extension = safeFileExtension(asset);
    const storagePath = buildSubmissionPhotoStoragePath({
      userId: input.userId,
      submissionId: input.submissionId,
      index,
      extension,
    });

    try {
      const upload = await uploadImageAssetToStorageBucket({
        asset,
        storagePath,
        logTag: 'uploadSubmissionPhotos',
      });
      if (!upload.ok) {
        throw new Error(upload.error);
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
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.error('[uploadSubmissionPhotos] photo upload failed', {
        submissionId: input.submissionId,
        index,
        storagePath,
        bucket: CAFE_USER_PHOTO_BUCKET,
        message,
        error,
      });
    }
  }

  return { uploadedCount, failedCount, errors };
}
