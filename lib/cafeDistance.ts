import type { Cafe } from '@/data/cafes';
import { formatDistanceMiles, haversineMiles } from '@/lib/distance';
import type { UserCoords } from '@/contexts/UserLocationContext';

export function withCafeDistances(cafes: Cafe[], userCoords: UserCoords): Cafe[] {
  return cafes.map((cafe) => {
    const distanceMiles = haversineMiles(
      userCoords,
      { latitude: cafe.latitude, longitude: cafe.longitude }
    );
    return {
      ...cafe,
      distanceMiles,
      distanceLabel: formatDistanceMiles(distanceMiles),
    };
  });
}

export function withinRadiusMiles(cafe: Cafe, radiusMiles: number): boolean {
  if (cafe.distanceMiles == null) return false;
  return cafe.distanceMiles <= radiusMiles;
}
