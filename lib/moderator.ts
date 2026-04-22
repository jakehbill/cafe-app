import { supabase } from '@/lib/supabase';

/**
 * Temporary app-level moderator allowlist.
 * Replace with DB roles/claims when admin roles are available.
 */
const MODERATOR_USER_IDS = new Set<string>([
  // Add your real Supabase auth user ID here.
  // Example: '11111111-2222-3333-4444-555555555555',
]);

export function isModerator(userId?: string | null): boolean {
  if (!userId) return false;
  return MODERATOR_USER_IDS.has(userId);
}

/**
 * Temporary debug helper to confirm the signed-in auth user id.
 * Safe to remove once allowlist is configured.
 */
export async function logCurrentAuthUserId(): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.log('[moderator] auth.getUser error:', error.message);
    return;
  }
  console.log('[moderator] current auth user id:', data.user?.id ?? null);
}

