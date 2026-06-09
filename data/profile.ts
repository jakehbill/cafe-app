/**
 * Profile / taste preferences — re-exports for the data layer (`public.profiles`).
 */
export {
  COFFEE_PREFERENCE_OPTIONS,
  createProfileIfMissing,
  getCurrentUserProfile,
  hydrateProfileIdentityFromAuth,
  INTENT_PREFERENCE_OPTIONS,
  isUsernameAvailable,
  normalizeSignupUsername,
  upsertSignupProfileForUser,
  updateProfile,
  updateProfilePreferences,
  validateSignupUsernameFormat,
  VIBE_PREFERENCE_OPTIONS,
  type UpdateProfileInput,
  type UpdateProfilePreferencesInput,
  type UserProfile,
} from '@/lib/profile';
