import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';

import type { Cafe } from '@/data/cafes';
import { MapCafeCallout } from '@/components/maps/MapCafeCallout';
import { BeanMapMarkerContent } from '@/components/maps/BeanMapMarkerContent';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';

/**
 * Native-only map implementation for Search (iOS/Android).
 * NOTE: This file must live outside `app/` so it isn't treated as a route on web.
 */
export default function SearchResultsMap({
  results,
  initialRegion,
  onPressCafe,
}: {
  results: Cafe[];
  initialRegion: Region;
  onPressCafe: (cafeId: string) => void;
}) {
  return (
    <MapView
      key={results.map((c) => c.id).join('-')}
      style={styles.map}
      initialRegion={initialRegion}
    >
      {results.map((cafe) => {
        const coffeeLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
        return (
          <Marker
            key={cafe.id}
            coordinate={{ latitude: cafe.latitude, longitude: cafe.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            title={cafe.name}
            description={cafe.neighborhood}
          >
            <View style={{ alignItems: 'center' }}>
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
});

