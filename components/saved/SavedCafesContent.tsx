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
import { useCafeState } from '@/contexts/CafeStateContext';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';

import { CompactCafeCard } from '@/components/CompactCafeCard';
import { FilterChip } from '@/components/FilterChip';
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

function uniqueSortedNeighborhoods(cafes: Cafe[]): string[] {
  const set = new Set<string>();
  for (const c of cafes) {
    const n = (c.neighborhood ?? '').trim();
    if (n.length > 0) set.add(n);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function uniqueSortedTags(cafes: Cafe[]): string[] {
  const set = new Set<string>();
  for (const c of cafes) {
    for (const t of c.tags ?? []) {
      const x = t.trim();
      if (x.length > 0) set.add(x);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function filterSavedCafes(
  cafes: Cafe[],
  locationKey: string | null,
  tagKey: string | null
): Cafe[] {
  return cafes.filter((cafe) => {
    if (locationKey != null) {
      if ((cafe.neighborhood ?? '').trim() !== locationKey) return false;
    }
    if (tagKey != null) {
      const needle = tagKey.toLowerCase();
      const hasTag = (cafe.tags ?? []).some((t) => t.trim().toLowerCase() === needle);
      if (!hasTag) return false;
    }
    return true;
  });
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
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

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

  const locationOptions = useMemo(() => uniqueSortedNeighborhoods(savedCafes), [savedCafes]);
  const tagOptions = useMemo(() => uniqueSortedTags(savedCafes), [savedCafes]);

  const filteredSaved = useMemo(
    () => filterSavedCafes(savedCafes, locationFilter, tagFilter),
    [savedCafes, locationFilter, tagFilter]
  );

  const showFilterRows =
    savedCafes.length > 0 && (locationOptions.length > 0 || tagOptions.length > 0);
  const hasActiveFilters = locationFilter != null || tagFilter != null;
  const showFilteredEmpty = savedCafes.length > 0 && filteredSaved.length === 0 && hasActiveFilters;

  const clearFilters = () => {
    setLocationFilter(null);
    setTagFilter(null);
  };

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
        <>
          {showFilterRows ? (
            <View style={styles.filterBlock}>
              {locationOptions.length > 0 ? (
                <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}>Area</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    <FilterChip
                      label="All areas"
                      selected={locationFilter === null}
                      onPress={() => setLocationFilter(null)}
                    />
                    {locationOptions.map((loc) => (
                      <FilterChip
                        key={loc}
                        label={loc}
                        selected={locationFilter === loc}
                        onPress={() =>
                          setLocationFilter((prev) => (prev === loc ? null : loc))
                        }
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {tagOptions.length > 0 ? (
                <View style={styles.filterSection}>
                  <Text style={styles.filterLabel}>Tag</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    <FilterChip
                      label="All tags"
                      selected={tagFilter === null}
                      onPress={() => setTagFilter(null)}
                    />
                    {tagOptions.map((tag) => (
                      <FilterChip
                        key={tag}
                        label={tag}
                        selected={tagFilter === tag}
                        onPress={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          ) : null}

          {showFilteredEmpty ? (
            <View style={styles.emptyFilterWrap}>
              <Text style={styles.emptyFilterTitle}>No saved cafes match</Text>
              <Text style={styles.subtitle}>Try changing or clearing your filters.</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.clearFiltersButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearFiltersText}>Clear filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {filteredSaved.map((cafe) => {
                return (
                  <CompactCafeCard
                    key={cafe.id}
                    cafe={cafe}
                    scorePosition="cardTopRight"
                    onPress={() => router.push(`/cafe/${cafe.id}`)}
                  />
                );
              })}
            </View>
          )}
        </>
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
  filterBlock: {
    gap: 12,
    marginBottom: 2,
  },
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chipsRow: {
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
    paddingRight: 8,
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
  emptyFilterWrap: {
    marginTop: 8,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 8,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  emptyFilterTitle: {
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  clearFiltersText: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
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
    gap: 14,
    paddingBottom: 8,
  },
});
