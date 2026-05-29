import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { SUGGEST_CAFE_RETURN_SEARCH } from '@/lib/authGate';
import { useOnboardingPreferencesForRanking } from '@/hooks/useOnboardingPreferencesForRanking';
import { TAG_SECTIONS } from '@/lib/cafeTags';
import { buildTasteProfileFromState, rankCafesForSearch } from '@/lib/cafeRanking';
import { CompactCafeCard } from '@/components/CompactCafeCard';
import SearchResultsMap from '@/components/maps/SearchResultsMap';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { withCafeDistances } from '@/lib/cafeDistance';
import { hasValidCafeCoordinates } from '@/lib/cafeMapsUrl';
import {
  cafeMatchesSelectedCanonicalTagsMeaningfully,
  fetchMeaningfulCafeIdsByCanonicalTag,
} from '@/lib/cafeTagSignal';

type ViewMode = 'list' | 'map';
type SearchSortMode = 'default' | 'nearest';
type RadiusFilter = 'any' | 0.5 | 1 | 2 | 5;
const SEARCH_RESULT_LIMIT = 10;
const MAP_RESULT_LIMIT = 150;
const SEARCH_DEBOUNCE_MS = 250;

type SearchQueryInputProps = {
  immediateQueryRef: React.MutableRefObject<string>;
  onDebouncedChange: (query: string) => void;
};

/** Local input state so typing does not re-render the whole Search screen. */
function SearchQueryInput({ immediateQueryRef, onDebouncedChange }: SearchQueryInputProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const isPending = query.trim() !== debouncedQuery.trim();

  useEffect(() => {
    immediateQueryRef.current = query;
  }, [query, immediateQueryRef]);

  useEffect(() => {
    onDebouncedChange(debouncedQuery);
  }, [debouncedQuery, onDebouncedChange]);

  return (
    <>
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
      {isPending ? <Text style={styles.searchPendingHint}>Searching…</Text> : null}
    </>
  );
}

const SearchResultCards = React.memo(function SearchResultCards({
  cafes,
  onPressCafe,
}: {
  cafes: Cafe[];
  onPressCafe: (id: string) => void;
}) {
  return (
    <>
      {cafes.map((cafe) => (
        <CompactCafeCard
          key={cafe.id}
          cafe={cafe}
          scorePosition="cardTopRight"
          reserveTagSpaceWhenEmpty
          showBookmarkAction
          onPress={() => onPressCafe(cafe.id)}
        />
      ))}
    </>
  );
});

function regionForCafes(cafeList: Cafe[]) {
  const cafesWithValidCoords = cafeList.filter((cafe) => hasValidCafeCoordinates(cafe));
  if (cafesWithValidCoords.length === 0) {
    return {
      latitude: 51.5256,
      longitude: -0.0754,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }
  const lat =
    cafesWithValidCoords.reduce((sum, c) => sum + c.latitude, 0) / cafesWithValidCoords.length;
  const lng =
    cafesWithValidCoords.reduce((sum, c) => sum + c.longitude, 0) / cafesWithValidCoords.length;
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };
}

export default function SearchScreen() {
  const router = useRouter();
  const { requireAuth } = useRequireAuth();
  const { ratingsByCafeId, visitedCafeIds, savedCafeIds } = useCafeState();
  const { cafes: cafeCatalog } = useCafeCatalog();
  const { coords: userLocation, refreshLocation, lastUpdatedAt } = useUserLocation();
  const immediateQueryRef = useRef('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const handleDebouncedSearchQuery = useCallback((q: string) => {
    setDebouncedSearchQuery(q);
  }, []);
  const handlePressCafe = useCallback(
    (cafeId: string) => {
      router.push(`/cafe/${cafeId}`);
    },
    [router]
  );
  const onboardingPrefs = useOnboardingPreferencesForRanking();
  const {
    focusCafeId: focusCafeIdRaw,
    focusLat: focusLatRaw,
    focusLng: focusLngRaw,
    cafe_id: cafeIdRawLegacy,
    latitude: latitudeRawLegacy,
    longitude: longitudeRawLegacy,
  } = useLocalSearchParams<{
    focusCafeId?: string | string[];
    focusLat?: string | string[];
    focusLng?: string | string[];
    cafe_id?: string | string[];
    latitude?: string | string[];
    longitude?: string | string[];
  }>();

  const focusCafeIdFromFocus =
    Array.isArray(focusCafeIdRaw) ? focusCafeIdRaw[0] : focusCafeIdRaw;
  const focusLatStrFromFocus = Array.isArray(focusLatRaw) ? focusLatRaw[0] : focusLatRaw;
  const focusLngStrFromFocus = Array.isArray(focusLngRaw) ? focusLngRaw[0] : focusLngRaw;

  const focusCafeIdFromLegacy = Array.isArray(cafeIdRawLegacy) ? cafeIdRawLegacy[0] : cafeIdRawLegacy;
  const focusLatStrFromLegacy = Array.isArray(latitudeRawLegacy)
    ? latitudeRawLegacy[0]
    : latitudeRawLegacy;
  const focusLngStrFromLegacy = Array.isArray(longitudeRawLegacy)
    ? longitudeRawLegacy[0]
    : longitudeRawLegacy;

  const focusCafeId = (String(focusCafeIdFromFocus ?? '').trim().length > 0
    ? focusCafeIdFromFocus
    : focusCafeIdFromLegacy) as string | undefined;

  function parseFiniteCoord(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function hasValidCoordinatePair(latitude: unknown, longitude: unknown): boolean {
    return (
      typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  const focusLatFromFocus = parseFiniteCoord(focusLatStrFromFocus);
  const focusLngFromFocus = parseFiniteCoord(focusLngStrFromFocus);
  const focusLatFromLegacy = parseFiniteCoord(focusLatStrFromLegacy);
  const focusLngFromLegacy = parseFiniteCoord(focusLngStrFromLegacy);

  const focusLat = focusLatFromFocus ?? focusLatFromLegacy;
  const focusLng = focusLngFromFocus ?? focusLngFromLegacy;
  const focusCoordsFromParams =
    focusLat != null && focusLng != null && hasValidCoordinatePair(focusLat, focusLng)
      ? { latitude: focusLat, longitude: focusLng }
      : null;

  const focusCafe = useMemo(() => {
    if (!focusCafeId) return null;
    const found = cafeCatalog.find((cafe) => cafe.id === focusCafeId);
    if (!found) return null;
    return hasValidCafeCoordinates(found) ? found : null;
  }, [focusCafeId, cafeCatalog]);

  const focusRegion = useMemo(() => {
    const selected =
      focusCafe != null
        ? { latitude: focusCafe.latitude, longitude: focusCafe.longitude }
        : focusCoordsFromParams;
    if (!selected) return null;
    return {
      latitude: selected.latitude,
      longitude: selected.longitude,
      // Slightly tighter zoom than general map averaging.
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [focusCafe, focusCoordsFromParams]);

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
    const stale =
      lastUpdatedAt == null || Date.now() - lastUpdatedAt > 5 * 60 * 1000;
    if (stale) void refreshLocation();
  }, [refreshLocation, lastUpdatedAt]);

  useEffect(() => {
    if (focusRegion) setViewMode('map');
  }, [focusRegion]);

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
    const q = debouncedSearchQuery.trim().toLowerCase();
    return rankCafesForSearch(
      cafesWithDistance,
      q,
      null,
      ratingsByCafeId,
      tasteProfile,
      onboardingPrefs
    );
  }, [debouncedSearchQuery, ratingsByCafeId, tasteProfile, onboardingPrefs, cafesWithDistance]);

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

  const filteredRankedResults = useMemo(() => {
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
  const listResults = useMemo(
    () => filteredRankedResults.slice(0, SEARCH_RESULT_LIMIT),
    [filteredRankedResults]
  );
  const mapResults = useMemo(() => {
    // Map mode intentionally uses a much larger pin set than curated list mode.
    let next = filteredRankedResults.filter(hasValidCafeCoordinates).slice(0, MAP_RESULT_LIMIT);

    // If navigated from cafe detail, force the selected cafe to be present so it can be centered + highlighted.
    if (focusCafe != null && !next.some((c) => c.id === focusCafe.id)) {
      next = [focusCafe, ...next];
    }
    return next.slice(0, MAP_RESULT_LIMIT);
  }, [filteredRankedResults, focusCafe]);

  const toggleTagSlug = (slug: string) => {
    setSelectedTagSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const clearTagFilters = () => setSelectedTagSlugs([]);

  const selectedCountForSection = (sectionTags: readonly string[]) =>
    selectedTagSlugs.filter((s) => sectionTags.includes(s)).length;

  const activeResults = viewMode === 'map' ? mapResults : listResults;
  const showNoResults = activeResults.length === 0;
  const hasQuery = debouncedSearchQuery.trim().length > 0;
  const resultsLabel =
    selectedTagSlugs.length === 0
      ? 'Top matches'
      : tagSignalLoading
        ? `Filtering · ${selectedTagSlugs.length} tag${selectedTagSlugs.length === 1 ? '' : 's'}…`
        : `Filtered · ${selectedTagSlugs.length} tag${selectedTagSlugs.length === 1 ? '' : 's'}`;

  const mapRegion = useMemo(() => focusRegion ?? regionForCafes(mapResults), [focusRegion, mapResults]);
  const isWeb = Platform.OS === 'web';
  const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();
  const hasCloseMatch = useMemo(() => {
    if (!normalizedQuery) return false;
    return ranked.slice(0, 5).some((cafe) => {
      const haystack = `${cafe.name} ${cafe.neighborhood}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, ranked]);
  /** Partial matches: prompt Google Places suggest only (not manual log-missing flow). */
  const showMissingCafeSuggestCta = hasQuery && !showNoResults && !hasCloseMatch;

  function openSuggestCafeFlow() {
    const initialSearch = immediateQueryRef.current.trim();
    if (!initialSearch) return;
    const returnTo = `/suggest-cafe?initialSearch=${encodeURIComponent(initialSearch)}&returnTo=${SUGGEST_CAFE_RETURN_SEARCH}`;
    if (!requireAuth(returnTo)) return;
    router.push({
      pathname: '/suggest-cafe',
      params: { initialSearch, returnTo: SUGGEST_CAFE_RETURN_SEARCH },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Search</Text>
        </View>
        <SearchQueryInput
          immediateQueryRef={immediateQueryRef}
          onDebouncedChange={handleDebouncedSearchQuery}
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
            {userLocation ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.distancePill,
                  sortMode === 'nearest' && styles.distancePillActive,
                ]}
                onPress={() => setSortMode('nearest')}
              >
                <Text
                  style={[
                    styles.distancePillLabel,
                    sortMode === 'nearest' && styles.distancePillLabelActive,
                  ]}
                >
                  Nearest
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {userLocation ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.radiusRow}
            >
              {([0.5, 1, 2, 5] as const).map((radius) => {
                const selected = radiusFilter === radius;
                return (
                  <TouchableOpacity
                    key={`radius-${radius}`}
                    activeOpacity={0.85}
                    style={[
                      styles.distancePill,
                      selected && styles.distancePillActive,
                    ]}
                    onPress={() => setRadiusFilter(radius)}
                  >
                    <Text
                      style={[
                        styles.distancePillLabel,
                        selected && styles.distancePillLabelActive,
                      ]}
                    >
                      {`${radius} mi`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.distancePill,
                  radiusFilter === 'any' && styles.distancePillActive,
                ]}
                onPress={() => setRadiusFilter('any')}
              >
                <Text
                  style={[
                    styles.distancePillLabel,
                    radiusFilter === 'any' && styles.distancePillLabelActive,
                  ]}
                >
                  Any distance
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <Text style={styles.distanceUnavailableHint}>Enable location to sort/filter by distance</Text>
          )}
        </View>
      </View>

      {viewMode === 'list' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showNoResults ? (
            <>
              <Text style={styles.emptyText}>
                {hasQuery
                  ? 'No strong matches yet. Try a cafe name, an area, or phrases like "quiet" or "good for work".'
                  : 'No cafes found'}
              </Text>
              {showNoResults && hasQuery ? (
                <View style={styles.logMissingWrap}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.logMissingButton}
                    onPress={openSuggestCafeFlow}
                  >
                    <Text style={styles.logMissingButtonText}>Suggest a café using Google Maps</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.resultsLabel}>{resultsLabel}</Text>
              {showMissingCafeSuggestCta ? (
                <View style={styles.logMissingWrap}>
                  <Text style={styles.logMissingInlineText}>Can&apos;t find the café?</Text>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.logMissingButton}
                    onPress={openSuggestCafeFlow}
                  >
                    <Text style={styles.logMissingButtonText}>Suggest a café using Google Maps</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <SearchResultCards cafes={listResults} onPressCafe={handlePressCafe} />
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.mapArea}>
          {showNoResults ? (
            <>
              <Text style={styles.emptyText}>
                {hasQuery
                  ? 'No strong matches yet. Try a cafe name, an area, or phrases like "quiet" or "good for work".'
                  : 'No cafes found'}
              </Text>
              {showNoResults && hasQuery ? (
                <View style={styles.logMissingWrap}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.logMissingButton}
                    onPress={openSuggestCafeFlow}
                  >
                    <Text style={styles.logMissingButtonText}>Suggest a café using Google Maps</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : isWeb ? (
            <ScrollView
              contentContainerStyle={styles.webList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.resultsLabel}>{resultsLabel}</Text>
              {mapResults.map((cafe) => (
                <TouchableOpacity
                  key={cafe.id}
                  activeOpacity={0.85}
                  style={[styles.webCard, focusCafeId === cafe.id && styles.webCardSelected]}
                  onPress={() => router.push(`/cafe/${cafe.id}`)}
                >
                  <Text style={styles.webCardTitle}>{cafe.name}</Text>
                  <Text style={styles.webCardSubtitle}>{cafe.neighborhood}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <SearchResultsMap
              results={mapResults}
              initialRegion={mapRegion}
              selectedCafeId={focusCafeId ?? undefined}
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  searchPendingHint: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    marginTop: -4,
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
  distancePillLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  distancePillLabelActive: {
    color: COLORS.accent,
  },
  distanceUnavailableHint: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
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
  logMissingWrap: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: 14,
    gap: 8,
  },
  logMissingButton: {
    marginTop: 2,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logMissingButtonText: {
    fontSize: 13,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  logMissingInlineText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
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
  webCardSelected: {
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
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
