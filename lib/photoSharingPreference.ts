/**
 * Account-level photo sharing preference (future settings screen).
 * Upload UI resolves a boolean via {@link resolveSharePubliclyForUpload}
 * without changing the visit save flow.
 */
export type PhotoSharingPreference =
  | 'always_private'
  | 'ask_every_time'
  | 'always_share';

/** Product default until a user setting exists. */
export const DEFAULT_PHOTO_SHARING_PREFERENCE: PhotoSharingPreference = 'ask_every_time';

/**
 * Resolve whether this upload batch should enter community moderation.
 * - always_private → false
 * - always_share → true
 * - ask_every_time → explicit choice (default false when unset)
 */
export function resolveSharePubliclyForUpload(params: {
  preference?: PhotoSharingPreference | null;
  /** Toggle value when preference is `ask_every_time`. */
  askEveryTimeChoice?: boolean | null;
}): boolean {
  const preference = params.preference ?? DEFAULT_PHOTO_SHARING_PREFERENCE;
  if (preference === 'always_private') return false;
  if (preference === 'always_share') return true;
  return params.askEveryTimeChoice === true;
}

/** Whether the per-upload share toggle should be shown. */
export function shouldShowPhotoShareToggle(
  preference: PhotoSharingPreference | null | undefined = DEFAULT_PHOTO_SHARING_PREFERENCE
): boolean {
  const pref = preference ?? DEFAULT_PHOTO_SHARING_PREFERENCE;
  return pref === 'ask_every_time';
}
