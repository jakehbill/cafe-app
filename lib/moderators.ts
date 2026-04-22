/**
 * Temporary moderator access control for internal tools.
 * Replace this allowlist with DB-backed roles when available.
 */
const MODERATOR_USER_IDS = new Set<string>([
  // Add Supabase auth user IDs here.
  // Example: '11111111-2222-3333-4444-555555555555',
]);

export function isModerator(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return MODERATOR_USER_IDS.has(userId);
}

