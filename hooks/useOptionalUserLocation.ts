import type { UserCoords } from '@/lib/cafeNearby';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

const CENTRAL_LONDON_COORDS = { latitude: 51.5074, longitude: -0.1278 };

/**
 * Optional device GPS for “nearby” filtering (`getNearbyCafes`).
 * Uses a central-London fallback when permission is denied/unavailable.
 */
export function useOptionalUserLocation(): UserCoords {
  const [coords, setCoords] = useState<UserCoords>(CENTRAL_LONDON_COORDS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          if (!cancelled) setCoords(CENTRAL_LONDON_COORDS);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch {
        if (!cancelled) setCoords(CENTRAL_LONDON_COORDS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
