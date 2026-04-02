import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import MapView, { Callout, Marker } from 'react-native-maps';

import { COLORS } from '@/components/theme';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';

/**
 * Native-only map implementation (iOS/Android).
 * This is the ONLY file that imports `react-native-maps`.
 */
export default function MapViewNative() {
  const router = useRouter();
  const { cafes } = useCafeCatalog();

  const initialRegion = useMemo(() => {
    const firstCafe = cafes[0];
    return {
      latitude: firstCafe?.latitude ?? 51.5256,
      longitude: firstCafe?.longitude ?? -0.0754,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [cafes]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Map view</Text>
        <Text style={styles.subtitle}>Tap a pin to open a cafe</Text>
      </View>

      <MapView style={styles.map} initialRegion={initialRegion}>
        {cafes.map((cafe) => (
          <Marker
            key={cafe.id}
            coordinate={{ latitude: cafe.latitude, longitude: cafe.longitude }}
            title={cafe.name}
            description={cafe.neighborhood}
          >
            <Callout onPress={() => router.push(`/cafe/${cafe.id}`)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{cafe.name}</Text>
                <Text style={styles.calloutSubtitle}>Tap to open cafe</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  map: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
  },
  callout: {
    minWidth: 160,
    maxWidth: 220,
    backgroundColor: COLORS.background,
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

