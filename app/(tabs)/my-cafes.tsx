import React from 'react';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { cafes } from '@/data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';

import { COLORS } from './components/theme';

export default function MyCafesScreen() {
  const router = useRouter();
  const { visitedCafeIds } = useCafeState();
  const visitedCafes = cafes.filter((cafe) => visitedCafeIds.includes(cafe.id));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Cafes</Text>

        {visitedCafes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>✓</Text>
            </View>
            <Text style={styles.emptyTitle}>You haven&apos;t visited any cafes yet</Text>
            <Text style={styles.subtitle}>Mark cafes as visited to keep track</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.ctaButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.ctaButtonText}>Explore cafes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {visitedCafes.map((cafe) => (
              <View key={cafe.id} style={styles.card}>
                <Text style={styles.cardName}>{cafe.name}</Text>
                <Text style={styles.cardNeighborhood}>{cafe.neighborhood}</Text>
                <Text numberOfLines={2} style={styles.cardSummary}>
                  {cafe.summary}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
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
  emptyWrap: {
    marginTop: 20,
    backgroundColor: '#F7F3EE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE3D5',
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(163, 177, 138, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.45)',
  },
  emptyIcon: {
    fontSize: 20,
    color: '#5B6E58',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#8A6A4F',
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 79, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ctaButtonText: {
    color: '#F7F3EE',
    fontSize: 13,
    fontWeight: '700',
  },
  listWrap: {
    gap: 10,
  },
  card: {
    backgroundColor: '#F7F3EE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE3D5',
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardNeighborhood: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardSummary: {
    color: '#4F4740',
    fontSize: 13,
    lineHeight: 19,
  },
});

