import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';

import type { Cafe } from '@/data/cafes';
import { COLORS } from '@/components/theme';

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
      {results.map((cafe) => (
        <Marker
          key={cafe.id}
          coordinate={{ latitude: cafe.latitude, longitude: cafe.longitude }}
          title={cafe.name}
          description={cafe.neighborhood}
        >
          <Callout onPress={() => onPressCafe(cafe.id)}>
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>{cafe.name}</Text>
              <Text style={styles.calloutSubtitle}>Tap to open cafe</Text>
            </View>
          </Callout>
        </Marker>
      ))}
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
  callout: {
    minWidth: 160,
    maxWidth: 220,
    backgroundColor: '#F7F3EE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DCCB',
    padding: 10,
    gap: 2,
  },
  calloutTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  calloutSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
  },
});

