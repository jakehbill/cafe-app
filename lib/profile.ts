import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/** Row shape for `public.profiles` (identity, taste preferences, onboarding). */
export type UserProfile = {
  user_id: string;
  /** Main user-facing name (editable; email stays in Supabase Auth only). */
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
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

function normalizeNameField(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

function normalizeUsername(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim().replace(/^@+/, '').toLowerCase();
  return t.length > 0 ? t : null;
}

/** Signup/editorial normalization — lowercase handle without leading @. */
export function normalizeSignupUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** Returns a user-facing error message, or null when the format is valid. */
export function validateSignupUsernameFormat(raw: string): string | null {
  const stripped = raw.trim().replace(/^@+/, '');
  if (!stripped) return 'Please choose a username.';
  if (/\s/.test(stripped)) return 'Username cannot contain spaces.';
  const normalized = stripped.toLowerCase();
  if (!/^[a-z0-9_.]+$/.test(normalized)) {
    return 'Use only letters, numbers, underscores, or periods.';
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

function devWarnSignup(context: string, detail: unknown) {
  if (!__DEV__) return;
  console.warn(`[signup] ${context}`, detail);
}

/** Pre-signup availability check against `public.profiles.username`. */
export async function isUsernameAvailable(
  raw: string
): Promise<{ available: boolean; error: string | null; checkSkipped?: boolean }> {
  const formatError = validateSignupUsernameFormat(raw);
  if (formatError) {
    return { available: false, error: formatError };
  }

  const normalized = normalizeSignupUsername(raw);

  const rpcRes = await supabase.rpc('is_username_taken', { p_username: normalized });
  if (!rpcRes.error) {
    if (rpcRes.data === true) {
      return { available: false, error: 'That username is already taken.' };
    }
    return { available: true, error: null };
  }

  const res = await supabase
    .from('profiles')
    .select('user_id')
    .eq('username', normalized)
    .maybeSingle();

  if (res.error) {
    devWarnSignup('username availability check failed', res.error);
    return {
      available: true,
      error: null,
      checkSkipped: true,
    };
  }
  if (res.data) {
    return { available: false, error: 'That username is already taken.' };
  }
  return { available: true, error: null };
}

export type SignupProfileInput = {
  first_name: string;
  last_name: string;
  username: string;
  /** Defaults to `username` when omitted. */
  display_name?: string | null;
  /** Saved when `public.profiles.email` exists; otherwise omitted. */
  email?: string;
  onboarding_completed?: boolean;
  coffee_preference?: string | null;
  vibe_preferences?: string[] | null;
  intent_preferences?: string[] | null;
};

/**
 * Creates or updates `public.profiles` for a known auth user id (post-signUp).
 * Uses a single upsert so a racing empty row from ProfileGate cannot win.
 */
export async function upsertSignupProfileForUser(
  userId: string,
  patch: SignupProfileInput
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const trimmedUserId = String(userId ?? '').trim();
  if (!trimmedUserId) {
    return { ok: false, error: 'Missing user id for profile.' };
  }

  const firstName = patch.first_name.trim();
  const lastName = patch.last_name.trim();
  const username = normalizeSignupUsername(patch.username);
  const email = (patch.email ?? '').trim().toLowerCase();

  if (!firstName || !lastName || !username) {
    return { ok: false, error: 'Missing required profile identity fields.' };
  }

  const row: Record<string, unknown> = {
    user_id: trimmedUserId,
    first_name: firstName,
    last_name: lastName,
    username,
    display_name: username,
    onboarding_completed: patch.onboarding_completed === true,
  };

  if (email) row.email = email;
  if (patch.coffee_preference != null) row.coffee_preference = patch.coffee_preference;
  if (patch.vibe_preferences != null) row.vibe_preferences = patch.vibe_preferences;
  if (patch.intent_preferences != null) row.intent_preferences = patch.intent_preferences;

  if (__DEV__) {
    devWarnSignup('profile upsert payload', row);
  }

  let res = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' }).select('user_id').single();

  if (res.error && email && res.error.message?.toLowerCase().includes('email')) {
    devWarnSignup('profile upsert retry without email column', res.error);
    const { email: _omit, ...withoutEmail } = row;
    res = await supabase
      .from('profiles')
      .upsert(withoutEmail, { onConflict: 'user_id' })
      .select('user_id')
      .single();
  }

  if (res.error) {
    const msg = res.error.message ?? '';
    if (res.error.code === '23505' && msg.toLowerCase().includes('username')) {
      return { ok: false, error: 'That username is already taken.', code: res.error.code };
    }
    devWarnSignup('profile upsert failed', res.error);
    return { ok: false, error: res.error.message, code: res.error.code };
  }

  return { ok: true };
}

/** Copy signup metadata into profile when profile identity fields are still empty. */
export async function hydrateProfileIdentityFromAuth(
  user: User,
  profile: UserProfile | null
): Promise<void> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const patch: UpdateProfileInput = {};

  if (!normalizeNameField(profile?.first_name) && normalizeNameField(String(meta.first_name ?? ''))) {
    patch.first_name = normalizeNameField(String(meta.first_name ?? ''));
  }
  if (!normalizeNameField(profile?.last_name) && normalizeNameField(String(meta.last_name ?? ''))) {
    patch.last_name = normalizeNameField(String(meta.last_name ?? ''));
  }
  if (!normalizeDisplayName(profile?.display_name) && normalizeDisplayName(String(meta.display_name ?? ''))) {
    patch.display_name = normalizeDisplayName(String(meta.display_name ?? ''));
  }
  if (!normalizeUsername(profile?.username) && normalizeUsername(String(meta.username ?? ''))) {
    patch.username = normalizeUsername(String(meta.username ?? ''));
  }

  if (Object.keys(patch).length === 0) return;
  await updateProfile(patch);
}

/** Partial update for `public.profiles` — only defined keys are sent. */
export type UpdateProfileInput = {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  coffee_preference?: string | null;
  vibe_preferences?: string[] | null;
  intent_preferences?: string[] | null;
  onboarding_completed?: boolean;
};

/** @deprecated Use `UpdateProfileInput` — same type; kept for existing call sites. */
export type UpdateProfilePreferencesInput = UpdateProfileInput;

function normalizeDisplayName(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Updates columns on `public.profiles` for the current user.
 * Only sends fields that are defined (undefined keys are omitted). Never touches columns you omit.
 */
export async function updateProfile(
  patch: UpdateProfileInput
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
  if (patch.display_name !== undefined) {
    row.display_name = normalizeDisplayName(patch.display_name ?? null);
  }
  if (patch.first_name !== undefined) {
    row.first_name = normalizeNameField(patch.first_name ?? null);
  }
  if (patch.last_name !== undefined) {
    row.last_name = normalizeNameField(patch.last_name ?? null);
  }
  if (patch.username !== undefined) {
    row.username = normalizeUsername(patch.username ?? null);
  }
  if (patch.avatar_url !== undefined) row.avatar_url = patch.avatar_url;
  if (patch.city !== undefined) row.city = patch.city;
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

/** Same as `updateProfile` — preferences-only name kept for call sites. */
export async function updateProfilePreferences(
  patch: UpdateProfileInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  return updateProfile(patch);
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
