import { supabase } from '@/lib/supabase';

/** Row shape for `public.profiles` (taste preferences + onboarding). */
export type UserProfile = {
  user_id: string;
  coffee_preference: string | null;
  vibe_preferences: string[] | null;
  intent_preferences: string[] | null;
  onboarding_completed: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ProfileResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

/**
 * Loads the current user's profile row, or `null` if none exists.
 */
export async function getCurrentUserProfile(): Promise<ProfileResult<UserProfile | null>> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError.message };
  }
  const userId = authData.user?.id;
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  const res = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();

  if (res.error) {
    return { data: null, error: res.error.message };
  }

  return { data: (res.data as UserProfile | null) ?? null, error: null };
}

/**
 * Ensures a `profiles` row exists for the current user (minimal insert: `user_id` only).
 * Safe to call repeatedly; returns the existing row if already present.
 */
export async function createProfileIfMissing(): Promise<ProfileResult<UserProfile>> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError.message };
  }
  const userId = authData.user?.id;
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  const existing = await getCurrentUserProfile();
  if (existing.error) {
    return { data: null, error: existing.error };
  }
  if (existing.data) {
    return { data: existing.data, error: null };
  }

  const insertRes = await supabase.from('profiles').insert({ user_id: userId }).select().single();

  if (insertRes.error) {
    const code = insertRes.error.code;
    if (code === '23505') {
      const again = await getCurrentUserProfile();
      if (again.data) {
        return { data: again.data, error: null };
      }
      return { data: null, error: again.error ?? insertRes.error.message };
    }
    return { data: null, error: insertRes.error.message };
  }

  if (!insertRes.data) {
    return { data: null, error: 'Insert returned no row' };
  }

  return { data: insertRes.data as UserProfile, error: null };
}

export type UpdateProfilePreferencesInput = {
  coffee_preference?: string | null;
  vibe_preferences?: string[] | null;
  intent_preferences?: string[] | null;
  onboarding_completed?: boolean;
};

/**
 * Updates preference columns on `public.profiles` for the current user.
 * Only sends fields that are defined (undefined keys are omitted).
 */
export async function updateProfilePreferences(
  patch: UpdateProfilePreferencesInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false, error: authError.message };
  }
  const userId = authData.user?.id;
  if (!userId) {
    return { ok: false, error: 'Not authenticated' };
  }

  const row: Record<string, unknown> = {};
  if (patch.coffee_preference !== undefined) row.coffee_preference = patch.coffee_preference;
  if (patch.vibe_preferences !== undefined) row.vibe_preferences = patch.vibe_preferences;
  if (patch.intent_preferences !== undefined) row.intent_preferences = patch.intent_preferences;
  if (patch.onboarding_completed !== undefined) row.onboarding_completed = patch.onboarding_completed;

  if (Object.keys(row).length === 0) {
    return { ok: true };
  }

  const res = await supabase.from('profiles').update(row).eq('user_id', userId);

  if (res.error) {
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

/** Step 1 — stored in `coffee_preference`. */
export const COFFEE_PREFERENCE_OPTIONS = [
  'Espresso-based (latte, cappuccino, flat white)',
  'Filter / pour-over',
  'Iced drinks',
  'I care more about the space',
] as const;

/** Step 2 — stored in `vibe_preferences`. */
export const VIBE_PREFERENCE_OPTIONS = [
  'Minimal / clean',
  'Cosy / warm',
  'Busy / buzzy',
  'Quiet / calm',
] as const;

/** Step 3 — stored in `intent_preferences`. */
export const INTENT_PREFERENCE_OPTIONS = [
  'A good place to work',
  'Great coffee first',
  'Catching up with friends',
  'Quiet solo time',
  'A bit of everything',
] as const;
