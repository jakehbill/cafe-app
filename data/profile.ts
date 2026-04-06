/**
 * Profile / taste preferences — re-exports for the data layer (`public.profiles`).
 */
export {
  COFFEE_PREFERENCE_OPTIONS,
  createProfileIfMissing,
  getCurrentUserProfile,
  INTENT_PREFERENCE_OPTIONS,
  updateProfilePreferences,
  VIBE_PREFERENCE_OPTIONS,
  type UpdateProfilePreferencesInput,
  type UserProfile,
} from '@/lib/profile';
