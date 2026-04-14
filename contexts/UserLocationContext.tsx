import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UserCoords = { latitude: number; longitude: number } | null;

type UserLocationState = {
  coords: UserCoords;
  permissionGranted: boolean;
  loading: boolean;
  lastUpdatedAt: number | null;
  refreshLocation: () => Promise<void>;
};

const UserLocationContext = createContext<UserLocationState | undefined>(undefined);

/**
 * Centralized location state for distance-aware discovery.
 * Prefers current location, falls back to last known location when needed.
 */
export function UserLocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<UserCoords>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const refreshLocation = useCallback(async () => {
    setLoading(true);
    try {
      let perms = await Location.getForegroundPermissionsAsync();
      if (!perms.granted && perms.status !== Location.PermissionStatus.DENIED) {
        perms = await Location.requestForegroundPermissionsAsync();
      }
      setPermissionGranted(perms.granted);
      if (!perms.granted) {
        setLoading(false);
        return;
      }

      let latitude: number | null = null;
      let longitude: number | null = null;

      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = current.coords.latitude;
        longitude = current.coords.longitude;
      } catch {
        /* fallback below */
      }

      if (latitude == null || longitude == null) {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
          latitude = lastKnown.coords.latitude;
          longitude = lastKnown.coords.longitude;
        }
      }

      if (latitude != null && longitude != null) {
        setCoords({ latitude, longitude });
        setLastUpdatedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLocation();
  }, [refreshLocation]);

  const value = useMemo(
    () => ({ coords, permissionGranted, loading, lastUpdatedAt, refreshLocation }),
    [coords, permissionGranted, loading, lastUpdatedAt, refreshLocation]
  );

  return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation() {
  const ctx = useContext(UserLocationContext);
  if (!ctx) throw new Error('useUserLocation must be used within UserLocationProvider');
  return ctx;
}
