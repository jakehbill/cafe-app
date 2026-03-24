import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from './components/theme';
import { cafes } from '@/data/cafes';

export default function MapScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  let MapView: any;
  let Marker: any;
  let Callout: any;

  if (!isWeb) {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Callout = Maps.Callout;
  }

  const initialRegion = useMemo(() => {
    const firstCafe = cafes[0];

    return {
      latitude: firstCafe?.latitude ?? 51.5256,
      longitude: firstCafe?.longitude ?? -0.0754,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Map view</Text>
        <Text style={styles.subtitle}>
          Interactive map available in mobile preview
        </Text>
      </View>

      {isWeb ? (
        <ScrollView contentContainerStyle={styles.webList}>
          {cafes.map((cafe) => (
            <TouchableOpacity
              key={cafe.id}
              activeOpacity={0.85}
              style={styles.webCard}
              onPress={() => router.push(`/cafe/${cafe.id}`)}
            >
              <Text style={styles.webCardTitle}>{cafe.name}</Text>
              <Text style={styles.webCardSubtitle}>{cafe.neighborhood}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : MapView && Marker && Callout ? (
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
      ) : null}
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
  webList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  webCard: {
    backgroundColor: '#F7F3EE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6DCCB',
    padding: 12,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  webCardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  webCardSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});

