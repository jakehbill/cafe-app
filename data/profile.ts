/**
 * Profile / taste preferences — re-exports for the data layer (`public.profiles`).
 */
export {
  COFFEE_PREFERENCE_OPTIONS,
  createProfileIfMissing,
  getCurrentUserProfile,
  INTENT_PREFERENCE_OPTIONS,
  updateProfile,
  updateProfilePreferences,
  VIBE_PREFERENCE_OPTIONS,
  type UpdateProfileInput,
  type UpdateProfilePreferencesInput,
  type UserProfile,
} from '@/lib/profile';
