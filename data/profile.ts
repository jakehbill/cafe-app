/**
 * Profile / taste preferences — re-exports for the data layer (`public.profiles`).
 */
export {
  createProfileIfMissing,
  getCurrentUserProfile,
  hydrateProfileIdentityFromAuth,
  isUsernameAvailable,
  markOnboardingComplete,
  normalizeSignupUsername,
  saveOnboardingAndComplete,
  upsertSignupProfileForUser,
  updateProfile,
  updateProfilePreferences,
  validateSignupUsernameFormat,
  type OnboardingAnswersInput,
  type ProfileUpdateResult,
  type UpdateProfileInput,
  type UpdateProfilePreferencesInput,
  type UserProfile,
} from '@/lib/profile';
