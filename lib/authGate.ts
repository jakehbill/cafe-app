import type { Router } from 'expo-router';

/** User-facing copy when a signed-in session is required. */
export const AUTH_REQUIRED_MESSAGE =
  'Please log in to save spaces and add reviews.';

export function parseReturnToParam(
  value: string | string[] | undefined
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw?.trim()) return null;
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

/** Safe in-app path for post-login navigation (rejects external URLs). */
export function sanitizeReturnTo(path: string | null | undefined): string | null {
  const trimmed = String(path ?? '').trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  return trimmed;
}

export function buildLoginPath(returnTo?: string | null): string {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return '/login';
  return `/login?returnTo=${encodeURIComponent(safe)}`;
}

export function buildAuthPath(returnTo?: string | null): string {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return '/auth';
  return `/auth?returnTo=${encodeURIComponent(safe)}`;
}

export function navigateAfterAuth(router: Router, returnTo: string | null | undefined) {
  const safe = sanitizeReturnTo(returnTo);
  if (safe) {
    router.replace(safe as never);
    return;
  }
  router.replace('/(tabs)' as never);
}

/** Shorthand on café detail `returnTo` / `source` when opened from visited cafés list. */
export const CAFE_DETAIL_RETURN_VISITED = 'visited';

/** Explicit back target from café detail query params; `null` = use default stack back. */
export function resolveCafeDetailBackPath(params: {
  returnTo?: string | string[] | null;
  source?: string | string[] | null;
}): string | null {
  const rt = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const src = Array.isArray(params.source) ? params.source[0] : params.source;
  if (rt === CAFE_DETAIL_RETURN_VISITED || src === CAFE_DETAIL_RETURN_VISITED) {
    return '/my-cafes';
  }
  return sanitizeReturnTo(parseReturnToParam(params.returnTo ?? undefined));
}

/** Shorthand on suggest-cafe when opened from Search no-results / search CTA. */
export const SUGGEST_CAFE_RETURN_SEARCH = 'search';

/** Shorthand when opened from Profile activity. */
export const SUGGEST_CAFE_RETURN_PROFILE = 'profile';

const SUGGEST_CAFE_RETURN_SHORTCUTS: Record<string, string> = {
  [SUGGEST_CAFE_RETURN_SEARCH]: '/search',
  [SUGGEST_CAFE_RETURN_PROFILE]: '/profile',
};

/** Explicit back target from suggest-cafe query params; `null` = use default stack back. */
export function resolveSuggestCafeBackPath(params: {
  returnTo?: string | string[] | null;
  source?: string | string[] | null;
}): string | null {
  const rt = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const src = Array.isArray(params.source) ? params.source[0] : params.source;
  for (const key of [rt, src]) {
    const trimmed = String(key ?? '').trim();
    if (!trimmed) continue;
    const shortcut = SUGGEST_CAFE_RETURN_SHORTCUTS[trimmed];
    if (shortcut) return shortcut;
  }
  return sanitizeReturnTo(parseReturnToParam(params.returnTo ?? undefined));
}
