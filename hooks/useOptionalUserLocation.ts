import type { UserCoords } from '@/lib/cafeNearby';

/**
 * Optional device GPS for “nearby” filtering (`getNearbyCafes`).
 *
 * Currently returns `null` → `getNearbyCafes` uses the dataset centroid + radius (see `lib/cafeNearby.ts`).
 *
 * To use real location: add `expo-location` (`npx expo install expo-location`), then request
 * foreground permission and `getCurrentPositionAsync`, and return `{ latitude, longitude }`.
 */
export function useOptionalUserLocation(): UserCoords {
  return null;
}
