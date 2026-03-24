import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { cafes, type Cafe } from '@/data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';

import { CompactCafeCard } from '@/app/(tabs)/components/CompactCafeCard';
import { COLORS } from '@/app/(tabs)/components/theme';

/** Map Supabase `cafe_id` values to full cafe objects from the local catalog (same ids). */
export function cafesFromSavedIds(savedIds: string[], catalog: Cafe[]): Cafe[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const result: Cafe[] = [];
  for (const rawId of savedIds) {
    const id = String(rawId);
    const cafe = byId.get(id);
    if (cafe) {
      result.push(cafe);
    }
  }
  return result;
}

type Props = {
  /** Tab shows a page title in the body; stack uses the native header instead */
  showPageTitle?: boolean;
};

/**
 * Shared Saved list UI (single source of truth for data + layout).
 * Used by the Saved tab and the root stack `/saved` screen (e.g. from Profile).
 */
export function SavedCafesContent({ showPageTitle = true }: Props) {
  const router = useRouter();
  const { savedCafeIds, ratingsByCafeId } = useCafeState();

  const savedCafes = useMemo(
    () => cafesFromSavedIds(savedCafeIds, cafes),
    [savedCafeIds]
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {showPageTitle ? <Text style={styles.title}>Saved</Text> : null}

      {savedCafes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>☆</Text>
          </View>
          <Text style={styles.emptyTitle}>No saved cafes yet</Text>
          <Text style={styles.subtitle}>Start saving cafes you want to try</Text>
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
          {savedCafes.map((cafe) => {
            const localRating = ratingsByCafeId[cafe.id];
            const coffee = localRating ? localRating.coffee : cafe.coffeeScore;
            const work = localRating ? localRating.work : cafe.workScore;
            const vibe = localRating ? localRating.vibe : cafe.vibeScore;

            return (
              <CompactCafeCard
                key={cafe.id}
                cafe={cafe}
                scores={{ coffee, work, vibe }}
                onPress={() => router.push(`/cafe/${cafe.id}`)}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#F1E9DC',
    borderWidth: 1,
    borderColor: '#E7DDCD',
  },
  emptyIcon: {
    fontSize: 22,
    color: '#8A6A4F',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
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
    paddingBottom: 8,
  },
});
