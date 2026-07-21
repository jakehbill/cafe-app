import type { User } from '@supabase/supabase-js';

import type { ProfileRow } from '@/types/database.types';
import { supabase } from '@/lib/supabase';

/** Row shape for `public.profiles` (identity, onboarding, legacy taste for ranking). */
export type UserProfile = {
  user_id: string;
  /** Main user-facing name (editable; email stays in Supabase Auth only). */
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  current_city: string | null;
  is_digital_nomad: boolean | null;
  workspace_type_preferences: string[] | null;
  work_style: string | null;
  workspace_frustration: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdateResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; error: string };

export type OnboardingAnswersInput = {
  current_city: string | null;
  is_digital_nomad: boolean;
  workspace_type_preferences: string[] | null;
  work_style: string | null;
  workspace_frustration: string | null;
};

function mapProfileRow(row: ProfileRow | Record<string, unknown>): UserProfile {
  const r = row as Record<string, unknown>;
  return {
    user_id: String(r.user_id ?? ''),
    display_name: (r.display_name as string | null) ?? null,
    first_name: (r.first_name as string | null) ?? null,
    last_name: (r.last_name as string | null) ?? null,
    username: (r.username as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    current_city: ((r.current_city ?? r.city) as string | null) ?? null,
    is_digital_nomad: (r.is_digital_nomad as boolean | null) ?? null,
    workspace_type_preferences: (r.workspace_type_preferences as string[] | null) ?? null,
    work_style: (r.work_style as string | null) ?? null,
    workspace_frustration:
      ((r.workspace_frustration ?? r.onboarding_biggest_frustration) as string | null) ?? null,
    onboarding_completed: (r.onboarding_completed as boolean | null) ?? null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  };
}

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

  if (!res.data) {
    return { data: null, error: null };
  }

  return { data: mapProfileRow(res.data as ProfileRow), error: null };
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

  return { data: mapProfileRow(insertRes.data as ProfileRow), error: null };
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
  email?: string | null;
  current_city?: string | null;
  is_digital_nomad?: boolean | null;
  workspace_type_preferences?: string[] | null;
  work_style?: string | null;
  workspace_frustration?: string | null;
  onboarding_completed?: boolean;
};

/** @deprecated Use `UpdateProfileInput` — same type; kept for existing call sites. */
export type UpdateProfilePreferencesInput = UpdateProfileInput;

function normalizeDisplayName(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function buildProfileUpdateRow(patch: UpdateProfileInput): Record<string, unknown> {
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
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.current_city !== undefined) row.current_city = patch.current_city;
  if (patch.is_digital_nomad !== undefined) row.is_digital_nomad = patch.is_digital_nomad;
  if (patch.workspace_type_preferences !== undefined) {
    row.workspace_type_preferences = patch.workspace_type_preferences;
  }
  if (patch.work_style !== undefined) row.work_style = patch.work_style;
  if (patch.workspace_frustration !== undefined) {
    row.workspace_frustration = patch.workspace_frustration;
  }
  if (patch.onboarding_completed !== undefined) row.onboarding_completed = patch.onboarding_completed;
  return row;
}

async function updateProfileRow(
  userId: string,
  row: Record<string, unknown>
): Promise<ProfileUpdateResult> {
  if (Object.keys(row).length === 0) {
    const current = await getCurrentUserProfile();
    if (current.error || !current.data) {
      return { ok: false, error: current.error ?? 'Profile not found after update.' };
    }
    return { ok: true, profile: current.data };
  }

  let res = await supabase.from('profiles').update(row).eq('user_id', userId).select('*').maybeSingle();

  // Pre-migration-06 fallback: write legacy column names if canonical names are missing.
  if (res.error && /column .* does not exist/i.test(res.error.message)) {
    const legacy: Record<string, unknown> = { ...row };
    if ('current_city' in legacy) {
      legacy.city = legacy.current_city;
      delete legacy.current_city;
    }
    if ('workspace_frustration' in legacy) {
      legacy.onboarding_biggest_frustration = legacy.workspace_frustration;
      delete legacy.workspace_frustration;
    }
    res = await supabase
      .from('profiles')
      .update(legacy)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
  }

  if (res.error) {
    return { ok: false, error: res.error.message };
  }
  if (!res.data) {
    return {
      ok: false,
      error: 'Profile update did not apply. Check RLS policies or run onboarding migrations.',
    };
  }

  return { ok: true, profile: mapProfileRow(res.data as ProfileRow) };
}

/**
 * Updates columns on `public.profiles` for the current user.
 * Returns the updated row so callers can verify persisted values.
 */
export async function updateProfile(patch: UpdateProfileInput): Promise<ProfileUpdateResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false, error: authError.message };
  }
  const userId = authData.user?.id;
  if (!userId) {
    return { ok: false, error: 'Not authenticated' };
  }

  return updateProfileRow(userId, buildProfileUpdateRow(patch));
}

/** Same as `updateProfile` — preferences-only name kept for call sites. */
export async function updateProfilePreferences(
  patch: UpdateProfileInput
): Promise<ProfileUpdateResult> {
  return updateProfile(patch);
}

/**
 * Persists onboarding answers, then marks onboarding complete in a second write.
 * Does not navigate — caller must refresh ProfileGate and route only after success.
 */
export async function saveOnboardingAndComplete(
  answers: OnboardingAnswersInput
): Promise<ProfileUpdateResult> {
  const answersRes = await updateProfile({
    current_city: answers.current_city,
    is_digital_nomad: answers.is_digital_nomad,
    workspace_type_preferences: answers.workspace_type_preferences,
    work_style: answers.work_style,
    workspace_frustration: answers.workspace_frustration,
  });
  if (!answersRes.ok) {
    return answersRes;
  }

  const completeRes = await updateProfile({ onboarding_completed: true });
  if (!completeRes.ok) {
    return completeRes;
  }

  if (completeRes.profile.onboarding_completed !== true) {
    return {
      ok: false,
      error: 'Onboarding completion was not saved. Please try again.',
    };
  }

  return completeRes;
}

/** Marks onboarding complete without answers (skip path). */
export async function markOnboardingComplete(): Promise<ProfileUpdateResult> {
  const res = await updateProfile({ onboarding_completed: true });
  if (!res.ok) {
    return res;
  }
  if (res.profile.onboarding_completed !== true) {
    return {
      ok: false,
      error: 'Could not mark onboarding complete. Please try again.',
    };
  }
  return res;
}
