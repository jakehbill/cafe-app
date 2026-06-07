/** Standalone public routes — no auth, no taste-onboarding redirect, no bootstrap overlay. */
export const PUBLIC_STANDALONE_ROUTES = new Set([
  'join',
  'working-from-cafes',
  'best-coffee-london',
  'hidden-gem-cafes',
  'cafe-diary',
]);

export function isPublicStandaloneRoute(segment: string | undefined): boolean {
  if (!segment) return false;
  return PUBLIC_STANDALONE_ROUTES.has(segment);
}
