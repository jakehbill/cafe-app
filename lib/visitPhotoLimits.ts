export const MAX_VISIT_PHOTOS = 3;

export const VISIT_PHOTO_MAX_MESSAGE = 'You can add up to 3 photos.';

export type VisitPhotoAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  /**
   * When true, photo is queued for public moderation after upload.
   * Default false — private diary only.
   */
  sharePublicly?: boolean;
};
