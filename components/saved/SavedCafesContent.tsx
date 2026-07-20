import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Cafe } from '@/data/cafes';
import { useAuth } from '@/contexts/AuthContext';
import { useCafeState } from '@/contexts/CafeStateContext';
import { buildLoginPath } from '@/lib/authGate';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';
import {
  DEFAULT_COLLECTION_FILTERS,
  filterCafesByCollectionFilters,
  hasActiveCollectionFilters,
  type CollectionFilterState,
} from '@/lib/collectionFilters';

import {
  CollectionFilterBar,
  CollectionFilterEmpty,
} from '@/components/collection/CollectionFilterBar';
import { CafeCardGrid } from '@/components/layout/CafeCardGrid';
import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
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
  const { user } = useAuth();
  const { savedCafeIds } = useCafeState();
  const [savedCafes, setSavedCafes] = useState<Cafe[]>([]);
  const [filters, setFilters] = useState<CollectionFilterState>(DEFAULT_COLLECTION_FILTERS);

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

  const filteredSaved = useMemo(
    () => filterCafesByCollectionFilters(savedCafes, filters),
    [savedCafes, filters]
  );

  const showFilteredEmpty =
    savedCafes.length > 0 &&
    filteredSaved.length === 0 &&
    hasActiveCollectionFilters(filters);

  return (
    <DesktopWebPageContainer variant="list" style={styles.pageContainer}>
    <ScrollView contentContainerStyle={styles.content}>
      {showPageTitle ? <Text style={styles.title}>Saved Spaces</Text> : null}

      {!user ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>☆</Text>
          </View>
          <Text style={styles.emptyTitle}>Sign in to save spaces</Text>
          <Text style={styles.subtitle}>
            Please log in to save spaces and add reviews.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.ctaButton}
            onPress={() => router.push(buildLoginPath('/bookmarks') as never)}
          >
            <Text style={styles.ctaButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      ) : savedCafes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>☆</Text>
          </View>
          <Text style={styles.emptyTitle}>No saved spaces yet</Text>
          <Text style={styles.subtitle}>Start saving spaces you want to work from</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.ctaButton}
            onPress={() => router.push('/')}
          >
            <Text style={styles.ctaButtonText}>Explore spaces</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <CollectionFilterBar cafes={savedCafes} filters={filters} onChange={setFilters} />

          {showFilteredEmpty ? (
            <CollectionFilterEmpty
              collectionLabel="saved"
              onClear={() => setFilters(DEFAULT_COLLECTION_FILTERS)}
            />
          ) : (
            <CafeCardGrid style={styles.listWrap}>
              {filteredSaved.map((cafe) => {
                return (
                  <CompactCafeCard
                    key={cafe.id}
                    cafe={cafe}
                    scorePosition="cardTopRight"
                    topRightActionLabel="Log a visit"
                    onTopRightActionPress={() => router.push(`/log-visit/${cafe.id}` as never)}
                    onPress={() => router.push(`/cafe/${cafe.id}`)}
                  />
                );
              })}
            </CafeCardGrid>
          )}
        </>
      )}
    </ScrollView>
    </DesktopWebPageContainer>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
  },
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
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
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
    color: COLORS.buttonLabelOnAccent,
    fontSize: 13,
    fontFamily: FONTS.sans.bold,
  },
  listWrap: {
    gap: 14,
    paddingBottom: 8,
  },
});
