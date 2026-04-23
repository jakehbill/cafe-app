import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import MapView, { Callout, Marker } from 'react-native-maps';

import { BeanMapMarkerContent } from '@/components/maps/BeanMapMarkerContent';
import { MapCafeCallout } from '@/components/maps/MapCafeCallout';
import { COLORS } from '@/components/theme';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { hasValidCafeCoordinates } from '@/lib/cafeMapsUrl';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';

/**
 * Native-only map implementation (iOS/Android).
 * This is the ONLY file that imports `react-native-maps`.
 */
export default function MapViewNative() {
  const router = useRouter();
  const { cafes } = useCafeCatalog();

  const initialRegion = useMemo(() => {
    const firstCafe = cafes.find((cafe) => hasValidCafeCoordinates(cafe));
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
        {cafes.filter(hasValidCafeCoordinates).map((cafe) => {
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
              <Callout onPress={() => router.push(`/cafe/${cafe.id}`)}>
                <MapCafeCallout cafeName={cafe.name} scoreDisplay={coffeeLabel} />
              </Callout>
            </Marker>
          );
        })}
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
});

