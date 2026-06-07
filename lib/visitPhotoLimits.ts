export const MAX_VISIT_PHOTOS = 3;

export const VISIT_PHOTO_MAX_MESSAGE = 'You can add up to 3 photos.';

export type VisitPhotoAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};
