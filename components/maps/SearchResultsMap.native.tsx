import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';

import type { Cafe } from '@/data/cafes';
import { MapCafeCallout } from '@/components/maps/MapCafeCallout';
import { BeanMapMarkerContent } from '@/components/maps/BeanMapMarkerContent';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';
import { hasValidCafeCoordinates } from '@/lib/cafeMapsUrl';
import { COLORS } from '@/components/theme';

/**
 * Native-only map implementation for Search (iOS/Android).
 * NOTE: This file must live outside `app/` so it isn't treated as a route on web.
 */
export default function SearchResultsMap({
  results,
  initialRegion,
  onPressCafe,
  selectedCafeId,
}: {
  results: Cafe[];
  initialRegion: Region;
  onPressCafe: (cafeId: string) => void;
  selectedCafeId?: string;
}) {
  return (
    <MapView
      key={`${results.map((c) => c.id).join('-')}-${selectedCafeId ?? 'none'}-${initialRegion.latitude},${initialRegion.longitude}-${initialRegion.latitudeDelta},${initialRegion.longitudeDelta}`}
      style={styles.map}
      initialRegion={initialRegion}
    >
      {results.filter(hasValidCafeCoordinates).map((cafe) => {
        const coffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
        const isSelected = selectedCafeId != null && cafe.id === selectedCafeId;
        return (
          <Marker
            key={cafe.id}
            coordinate={{ latitude: cafe.latitude, longitude: cafe.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            title={cafe.name}
            description={cafe.neighborhood}
          >
            <View style={isSelected ? styles.selectedMarkerWrap : styles.markerWrap}>
              <BeanMapMarkerContent />
            </View>
            <Callout onPress={() => onPressCafe(cafe.id)}>
              <MapCafeCallout cafeName={cafe.name} scoreDisplay={coffeeLabel} />
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
  },
  markerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedMarkerWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: 'rgba(163,177,138,0.18)',
  },
});

