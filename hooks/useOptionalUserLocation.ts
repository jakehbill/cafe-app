import { useUserLocation, type UserCoords } from '@/contexts/UserLocationContext';

/**
 * Legacy compatibility hook for call sites expecting optional coords only.
 * New code should use `useUserLocation()` for full location state.
 */
export function useOptionalUserLocation(): UserCoords {
  return useUserLocation().coords;
}
