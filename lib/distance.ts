type Coords = { latitude: number; longitude: number } | null | undefined;

const EARTH_RADIUS_MILES = 3958.7613;

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Straight-line distance (miles) between two points using haversine.
 * Returns null for missing/invalid coordinates.
 */
export function haversineMiles(from: Coords, to: Coords): number | null {
  if (!from || !to) return null;
  const { latitude: lat1, longitude: lon1 } = from;
  const { latitude: lat2, longitude: lon2 } = to;
  if (!isFiniteCoord(lat1) || !isFiniteCoord(lon1) || !isFiniteCoord(lat2) || !isFiniteCoord(lon2)) {
    return null;
  }

  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * Discovery-friendly distance label:
 * - < 10 mi => 1 decimal
 * - >= 10 mi => whole miles
 */
export function formatDistanceMiles(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles)) return null;
  if (miles < 0) return null;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
