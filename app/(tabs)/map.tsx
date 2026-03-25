import React from 'react';

import MapView from '@/components/maps/MapView';

/**
 * Map route (safe on all platforms).
 * Platform-specific map code lives in `components/maps/MapView.*.tsx`.
 */
export default function MapScreen() {
  return <MapView />;
}
