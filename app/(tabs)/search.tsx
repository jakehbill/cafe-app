import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { useCafeState } from '@/contexts/CafeStateContext';
import type { Cafe } from '@/data/cafes';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { useOnboardingPreferencesForRanking } from '@/hooks/useOnboardingPreferencesForRanking';
import { TAG_SECTIONS } from '@/lib/cafeTags';
import { buildTasteProfileFromState, rankCafesForSearch } from '@/lib/cafeRanking';
import { CompactCafeCard } from '@/components/CompactCafeCard';
import SearchResultsMap from '@/components/maps/SearchResultsMap';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { withCafeDistances } from '@/lib/cafeDistance';
import {
  cafeMatchesSelectedCanonicalTagsMeaningfully,
  fetchMeaningfulCafeIdsByCanonicalTag,
} from '@/lib/cafeTagSignal';

type ViewMode = 'list' | 'map';
type SearchSortMode = 'default' | 'nearest';
type RadiusFilter = 'any' | 0.5 | 1 | 2 | 5;

function regionForCafes(cafeList: Cafe[]) {
  if (cafeList.length === 0) {
    return {
      latitude: 51.5256,
      longitude: -0.0754,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }
  const lat = cafeList.reduce((sum, c) => sum + c.latitude, 0) / cafeList.length;
  const lng = cafeList.reduce((sum, c) => sum + c.longitude, 0) / cafeList.length;
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };
}

export default function SearchScreen() {
  const router = useRouter();
  const { ratingsByCafeId, visitedCafeIds, savedCafeIds } = useCafeState();
  const { cafes: cafeCatalog } = useCafeCatalog();
  const { coords: userLocation, refreshLocation } = useUserLocation();
  const onboardingPrefs = useOnboardingPreferencesForRanking();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SearchSortMode>('default');
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('any');
  const [expandedCategoryTitle, setExpandedCategoryTitle] = useState<string | null>(null);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([]);
  const [tagSignalLoading, setTagSignalLoading] = useState(false);
  const [meaningfulCafeIdsBySlug, setMeaningfulCafeIdsBySlug] = useState<Map<string, Set<string>>>(
    () => new Map()
  );

  useEffect(() => {
    // Refresh on mount so distances are recalculated when screen opens.
    void refreshLocation();
  }, [refreshLocation]);

  useEffect(() => {
    if (sortMode === 'nearest' || radiusFilter !== 'any') {
      // Refresh when using location-sensitive controls; no constant polling.
      void refreshLocation();
    }
  }, [sortMode, radiusFilter, refreshLocation]);

  const cafesWithDistance = useMemo(
    () => withCafeDistances(cafeCatalog, userLocation),
    [cafeCatalog, userLocation]
  );

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafesWithDistance, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, cafesWithDistance, visitedCafeIds, savedCafeIds]
  );

  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rankCafesForSearch(
      [...cafesWithDistance],
      q,
      null,
      ratingsByCafeId,
      tasteProfile,
      onboardingPrefs
    );
  }, [query, ratingsByCafeId, tasteProfile, onboardingPrefs, cafesWithDistance]);

  // When tag filters change, fetch rating-derived “meaningful signal” sets (cached in memory here).
  useEffect(() => {
    let cancelled = false;

    if (selectedTagSlugs.length === 0) {
      setMeaningfulCafeIdsBySlug(new Map());
      setTagSignalLoading(false);
      return;
    }

    setTagSignalLoading(true);
    setMeaningfulCafeIdsBySlug(new Map());
    void (async () => {
      const cafeIds = ranked.map((c) => c.id);
      const map = await fetchMeaningfulCafeIdsByCanonicalTag(cafeIds, selectedTagSlugs);
      if (cancelled) return;
      setMeaningfulCafeIdsBySlug(map);
      setTagSignalLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTagSlugs, ranked]);

  const results = useMemo(() => {
    let next = ranked;
    if (selectedTagSlugs.length > 0) {
      // Wait for rating_tags-derived sets; do not use cafes.tags for filtering.
      if (tagSignalLoading) return ranked;
      next = ranked.filter((cafe) =>
        cafeMatchesSelectedCanonicalTagsMeaningfully(cafe.id, selectedTagSlugs, meaningfulCafeIdsBySlug)
      );
    }

    // No location means nearest/radius controls gracefully become no-ops.
    if (userLocation && radiusFilter !== 'any') {
      next = next.filter((cafe) => cafe.distanceMiles != null && cafe.distanceMiles <= radiusFilter);
    }

    if (sortMode === 'nearest' && userLocation) {
      next = [...next].sort((a, b) => {
        const aMiles = a.distanceMiles ?? Number.MAX_SAFE_INTEGER;
        const bMiles = b.distanceMiles ?? Number.MAX_SAFE_INTEGER;
        return aMiles - bMiles;
      });
    }

    return next;
  }, [
    ranked,
    selectedTagSlugs,
    meaningfulCafeIdsBySlug,
    tagSignalLoading,
    userLocation,
    radiusFilter,
    sortMode,
  ]);

  const toggleTagSlug = (slug: string) => {
    setSelectedTagSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const clearTagFilters = () => setSelectedTagSlugs([]);

  const selectedCountForSection = (sectionTags: readonly string[]) =>
    selectedTagSlugs.filter((s) => sectionTags.includes(s)).length;

  const showNoResults = results.length === 0;
  const resultsLabel =
    selectedTagSlugs.length === 0
      ? 'Top matches'
      : tagSignalLoading
        ? `Filtering · ${selectedTagSlugs.length} tag${selectedTagSlugs.length === 1 ? '' : 's'}…`
        : `Filtered · ${selectedTagSlugs.length} tag${selectedTagSlugs.length === 1 ? '' : 's'}`;

  const mapRegion = useMemo(() => regionForCafes(results), [results]);
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search cafes..."
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={styles.input}
        />

        <View style={styles.categoryFiltersWrap}>
          <View style={styles.categoryRow}>
            {TAG_SECTIONS.map((section) => {
              const n = selectedCountForSection(section.tags);
              const open = expandedCategoryTitle === section.title;
              return (
                <Pressable
                  key={section.title}
                  accessibilityRole="button"
                  accessibilityLabel={`${section.title} tags${n > 0 ? `, ${n} selected` : ''}`}
                  onPress={() =>
                    setExpandedCategoryTitle((prev) => (prev === section.title ? null : section.title))
                  }
                  style={({ pressed }) => [
                    styles.categoryPill,
                    open && styles.categoryPillOpen,
                    n > 0 && styles.categoryPillHasTags,
                    pressed && styles.categoryPillPressed,
                  ]}
                >
                  <Text
                    style={[styles.categoryPillText, n > 0 && styles.categoryPillTextActive]}
                    numberOfLines={1}
                  >
                    {section.title}
                  </Text>
                  {n > 0 ? (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{n}</Text>
                    </View>
                  ) : null}
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={n > 0 || open ? COLORS.accent : COLORS.muted}
                  />
                </Pressable>
              );
            })}
          </View>

          {expandedCategoryTitle ? (
            <View style={styles.tagPanel}>
              {TAG_SECTIONS.filter((s) => s.title === expandedCategoryTitle).map((section) => (
                <View key={section.title} style={styles.tagPanelInner}>
                  {section.tags.map((tag) => {
                    const selected = selectedTagSlugs.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        activeOpacity={0.85}
                        style={[styles.tagChip, selected && styles.tagChipSelected]}
                        onPress={() => toggleTagSlug(tag)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <TagWithOptionalIcon
                          tag={tag}
                          iconSize={14}
                          color={selected ? COLORS.accent : COLORS.text}
                          textStyle={[
                            styles.tagChipText,
                            selected && styles.tagChipTextSelected,
                          ]}
                          gap={5}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}

          {selectedTagSlugs.length > 0 ? (
            <TouchableOpacity
              onPress={clearTagFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear tag filters"
              style={styles.clearTagsRow}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Text style={styles.clearTagsText}>Clear tags</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.viewToggleWrap}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.viewTogglePill, viewMode === 'list' && styles.viewTogglePillActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.viewToggleLabel, viewMode === 'list' && styles.viewToggleLabelActive]}>
              List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.viewTogglePill, viewMode === 'map' && styles.viewTogglePillActive]}
            onPress={() => setViewMode('map')}
          >
            <Text style={[styles.viewToggleLabel, viewMode === 'map' && styles.viewToggleLabelActive]}>
              Map
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.distanceControlsWrap}>
          <View style={styles.distanceSortRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.distancePill,
                sortMode === 'default' && styles.distancePillActive,
              ]}
              onPress={() => setSortMode('default')}
            >
              <Text
                style={[
                  styles.distancePillLabel,
                  sortMode === 'default' && styles.distancePillLabelActive,
                ]}
              >
                Default
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.distancePill,
                sortMode === 'nearest' && styles.distancePillActive,
                !userLocation && styles.distancePillDisabled,
              ]}
              onPress={() => setSortMode('nearest')}
              disabled={!userLocation}
            >
              <Text
                style={[
                  styles.distancePillLabel,
                  sortMode === 'nearest' && styles.distancePillLabelActive,
                  !userLocation && styles.distancePillLabelDisabled,
                ]}
              >
                Nearest
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.radiusRow}
          >
            {(['any', 0.5, 1, 2, 5] as const).map((radius) => {
              const selected = radiusFilter === radius;
              const disabled = radius !== 'any' && !userLocation;
              return (
                <TouchableOpacity
                  key={`radius-${radius}`}
                  activeOpacity={0.85}
                  style={[
                    styles.distancePill,
                    selected && styles.distancePillActive,
                    disabled && styles.distancePillDisabled,
                  ]}
                  onPress={() => setRadiusFilter(radius)}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.distancePillLabel,
                      selected && styles.distancePillLabelActive,
                      disabled && styles.distancePillLabelDisabled,
                    ]}
                  >
                    {radius === 'any' ? 'Any distance' : `${radius} mi`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {viewMode === 'list' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showNoResults ? (
            <Text style={styles.emptyText}>No cafes found</Text>
          ) : (
            <>
              <Text style={styles.resultsLabel}>{resultsLabel}</Text>
              {results.map((cafe) => {
                return (
                  <CompactCafeCard
                    key={cafe.id}
                    cafe={cafe}
                    scorePosition="cardTopRight"
                    reserveTagSpaceWhenEmpty
                    onPress={() => router.push(`/cafe/${cafe.id}`)}
                  />
                );
              })}
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.mapArea}>
          {showNoResults ? (
            <Text style={styles.emptyText}>No cafes found</Text>
          ) : isWeb ? (
            <ScrollView
              contentContainerStyle={styles.webList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.resultsLabel}>{resultsLabel}</Text>
              {results.map((cafe) => (
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
          ) : (
            <SearchResultsMap
              results={results}
              initialRegion={mapRegion}
              onPressCafe={(cafeId: string) => router.push(`/cafe/${cafeId}`)}
            />
          )}
        </View>
      )}
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
    paddingBottom: 8,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
  },
  categoryFiltersWrap: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    maxWidth: '48%',
  },
  categoryPillOpen: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  categoryPillHasTags: {
    borderColor: COLORS.accentSubtleBorder,
  },
  categoryPillPressed: {
    opacity: 0.92,
  },
  categoryPillText: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    flexShrink: 1,
  },
  categoryPillTextActive: {
    color: COLORS.accent,
  },
  categoryBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.sans.bold,
    color: '#ffffff',
  },
  tagPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 10,
  },
  tagPanelInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagChipSelected: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  tagChipText: {
    fontSize: 14,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
  },
  tagChipTextSelected: {
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  clearTagsRow: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  clearTagsText: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
  },
  viewToggleWrap: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 3,
    gap: 2,
  },
  viewTogglePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  viewTogglePillActive: {
    backgroundColor: COLORS.accentSubtleFill,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
  },
  viewToggleLabel: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  viewToggleLabelActive: {
    color: COLORS.accent,
  },
  distanceControlsWrap: {
    gap: 8,
  },
  distanceSortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusRow: {
    gap: 8,
    paddingRight: 20,
  },
  distancePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  distancePillActive: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
  },
  distancePillDisabled: {
    opacity: 0.5,
  },
  distancePillLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  distancePillLabelActive: {
    color: COLORS.accent,
  },
  distancePillLabelDisabled: {
    color: COLORS.muted,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  resultsLabel: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
  },
  mapArea: {
    flex: 1,
    minHeight: 200,
  },
  webList: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14,
  },
  webCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    gap: 4,
    ...SHADOWS.none,
  },
  webCardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.display.semibold,
  },
  webCardSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
  },
});
