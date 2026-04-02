import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Cafe } from '@/data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';

import { CompactCafeCard } from '@/components/CompactCafeCard';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';

/** Map Supabase `cafe_id` values to full cafe rows from `public.cafes` (same ids). */
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
 * Used by the Saved tab (`/bookmarks`) and the root stack `/saved` screen (e.g. from Profile).
 */
export function SavedCafesContent({ showPageTitle = true }: Props) {
  const router = useRouter();
  const { savedCafeIds } = useCafeState();
  const [savedCafes, setSavedCafes] = useState<Cafe[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchCafesByIdsOrdered(savedCafeIds);
      if (__DEV__) {
        console.log('[DEBUG SavedCafesContent]', {
          savedIdCount: savedCafeIds.length,
          resolvedCafeCount: list.length,
        });
      }
      if (!cancelled) setSavedCafes(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [savedCafeIds]);

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
            return (
              <CompactCafeCard
                key={cafe.id}
                cafe={cafe}
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
    fontSize: 28,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  emptyWrap: {
    marginTop: 20,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 10,
    alignItems: 'center',
    ...SHADOWS.card,
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
    color: COLORS.accent,
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
    backgroundColor: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 26, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: FONTS.sans.bold,
  },
  listWrap: {
    gap: 10,
    paddingBottom: 8,
  },
});
