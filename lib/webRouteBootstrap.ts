import { Platform } from 'react-native';

/** Paths that only exist on the signed-in root stack (not onboarding/auth). */
const SIGNED_IN_PATH_PREFIXES = [
  '/cafe/',
  '/rate/',
  '/log-visit/',
  '/saved',
  '/ratings',
  '/my-cafes',
  '/suggest-cafe',
  '/moderation',
  '/moderation-create-cafe',
  '/onboarding-preferences',
  '/modal',
];

const SIGNED_IN_EXACT = new Set([
  '/',
  '/search',
  '/bookmarks',
  '/profile',
  '/map',
  '/(tabs)',
  '/(tabs)/index',
  '/(tabs)/search',
  '/(tabs)/bookmarks',
  '/(tabs)/profile',
  '/(tabs)/map',
]);

/**
 * While Supabase session is restoring on web, keep the signed-in stack mounted for deep URLs
 * so refresh on /cafe/:id does not fall back to the tab anchor/home.
 */
export function pathUsesSignedInStack(pathname: string | null | undefined): boolean {
  const path = String(pathname ?? '').trim();
  if (!path) return false;
  if (path === '/onboarding' || path === '/auth' || path === '/login') return false;
  if (SIGNED_IN_EXACT.has(path)) return true;
  if (path.startsWith('/(tabs)')) return true;
  return SIGNED_IN_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Guests may browse public routes without signing in (all platforms). */
export function shouldMountBrowsingStack(params: {
  hasUser: boolean;
  pathname: string | null | undefined;
}): boolean {
  if (params.hasUser) return true;
  return pathUsesSignedInStack(params.pathname);
}

/**
 * While Supabase session is restoring on web, keep the browsing stack mounted for deep URLs
 * so refresh on /cafe/:id does not fall back to onboarding.
 */
export function shouldMountSignedInStackDuringAuthLoad(params: {
  loading: boolean;
  hasUser: boolean;
  pathname: string | null | undefined;
}): boolean {
  if (shouldMountBrowsingStack(params)) return true;
  if (!params.loading) return false;
  if (Platform.OS !== 'web') return false;
  return pathUsesSignedInStack(params.pathname);
}
