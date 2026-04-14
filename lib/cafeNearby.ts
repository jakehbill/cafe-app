import type { Cafe } from '@/data/cafes';

/**
 * “Nearby” for Trending (MVP).
 *
 * - With GPS: cafes within `NEARBY_RADIUS_MILES` of the user.
 * - Without GPS: anchor = fallback central location, same radius.
 *
 * Tweak `NEARBY_RADIUS_MILES` or fallback behavior here.
 */

export const NEARBY_RADIUS_MILES = 1.25;

const EARTH_RADIUS_MILES = 3958.7613;

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const rLat = (lat2 - lat1) * (Math.PI / 180);
  const rLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(rLat / 2) * Math.sin(rLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(rLng / 2) *
      Math.sin(rLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
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

export type UserCoords = { latitude: number; longitude: number } | null;

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
