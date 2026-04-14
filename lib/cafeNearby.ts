import type { Cafe } from '@/data/cafes';
import { haversineMiles as haversineMilesRaw } from '@/lib/distance';
import type { UserCoords } from '@/contexts/UserLocationContext';

/**
 * “Nearby” for Trending (MVP).
 *
 * - With GPS: cafes within `NEARBY_RADIUS_MILES` of the user.
 * - Without GPS: anchor = fallback central location, same radius.
 *
 * Tweak `NEARBY_RADIUS_MILES` or fallback behavior here.
 */

export const NEARBY_RADIUS_MILES = 1;

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineMilesRaw(
    { latitude: lat1, longitude: lng1 },
    { latitude: lat2, longitude: lng2 }
  ) ?? 0;
}

/** Geographic center of the cafe list (fallback “you are here” when GPS unavailable). */
export function getDatasetCentroid(cafes: Cafe[]): { latitude: number; longitude: number } {
  if (cafes.length === 0) {
    return { latitude: 51.5256, longitude: -0.0754 };
  }
  let slat = 0;
  let slng = 0;
  for (const c of cafes) {
    slat += c.latitude;
    slng += c.longitude;
  }
  const n = cafes.length;
  return { latitude: slat / n, longitude: slng / n };
}

/**
 * Returns cafes considered “nearby”, then caller ranks them (e.g. trending).
 */
export function getNearbyCafes(allCafes: Cafe[], userLocation: UserCoords): Cafe[] {
  if (allCafes.length === 0) {
    return [];
  }

  const anchor = userLocation ?? getDatasetCentroid(allCafes);

  const scored = allCafes.map((cafe) => ({
    cafe,
    miles: haversineMiles(anchor.latitude, anchor.longitude, cafe.latitude, cafe.longitude),
  }));

  const within = scored.filter((s) => s.miles <= NEARBY_RADIUS_MILES).map((s) => s.cafe);
  return within;
}

export function getNearbyCafesWithinRadius(
  allCafes: Cafe[],
  userLocation: UserCoords,
  radiusMiles: number
): Cafe[] {
  if (allCafes.length === 0 || !userLocation) return [];
  return allCafes.filter((cafe) => {
    const miles = haversineMilesRaw(userLocation, {
      latitude: cafe.latitude,
      longitude: cafe.longitude,
    });
    return miles != null && miles <= radiusMiles;
  });
}
