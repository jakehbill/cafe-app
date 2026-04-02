import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Platform,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useCafeState } from '@/contexts/CafeStateContext';
import type { Cafe } from '@/data/cafes';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { useOptionalUserLocation } from '@/hooks/useOptionalUserLocation';
import { rankTrendingNearbyForSearch } from '@/lib/cafeTrending';
import { buildTasteProfileFromState, rankCafesForSearch, type RankKey } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';

import { CompactCafeCard } from '@/components/CompactCafeCard';
import { FilterChip } from '@/components/FilterChip';
import { getSearchFilterIcon } from '@/lib/tagIcons';
import SearchResultsMap from '@/components/maps/SearchResultsMap';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';

/** Search chips: intent filters + non-personalized trending (aligned with Home). */
type SearchChipId = RankKey | 'trending';

const RANK_CHIPS: { id: SearchChipId; label: string }[] = [
  { id: 'work', label: 'Best for Work' },
  { id: 'coffee', label: 'Great Coffee' },
  { id: 'atmosphere', label: 'Great Atmosphere' },
  { id: 'quiet', label: 'Quiet' },
  { id: 'quick', label: 'Quick' },
  { id: 'trending', label: 'Trending Nearby' },
];

type ViewMode = 'list' | 'map';

function parseRankParam(raw: string | string[] | undefined): RankKey | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'work' || v === 'coffee' || v === 'atmosphere' || v === 'quiet' || v === 'quick') {
    return v;
  }
  return null;
}

function resultsHeadingLabel(selectedChip: SearchChipId | null): string {
  if (selectedChip === null) {
    return 'Top matches';
  }
  if (selectedChip === 'trending') {
    return 'Trending nearby';
  }
  switch (selectedChip) {
    case 'work':
      return 'Best matches for work';
    case 'coffee':
      return 'Best coffee picks';
    case 'atmosphere':
      return 'Great atmosphere picks';
    case 'quiet':
      return 'Quiet spots';
    case 'quick':
      return 'Quick stops';
  }
}

function regionForCafes(cafeList: Cafe[]) {
  if (cafeList.length === 0) {
    return {
      latitude: 51.5256,
      longitude: -0.0754,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }
  const lat =
    cafeList.reduce((sum, c) => sum + c.latitude, 0) / cafeList.length;
  const lng =
    cafeList.reduce((sum, c) => sum + c.longitude, 0) / cafeList.length;
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };
}

export default function SearchScreen() {
  const router = useRouter();
  const { rank: rankParam } = useLocalSearchParams<{ rank?: string | string[] }>();
  const { ratingsByCafeId, visitedCafeIds, savedCafeIds } = useCafeState();
  const { cafes: cafeCatalog } = useCafeCatalog();
  const userLocation = useOptionalUserLocation();
  const [query, setQuery] = useState('');
  const [selectedChip, setSelectedChip] = useState<SearchChipId | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    const parsed = parseRankParam(rankParam);
    if (parsed !== null) {
      setSelectedChip(parsed);
    }
  }, [rankParam]);

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (selectedChip === 'trending') {
      return rankTrendingNearbyForSearch([...cafeCatalog], q, userLocation);
    }
    return rankCafesForSearch([...cafeCatalog], q, selectedChip, ratingsByCafeId, tasteProfile);
  }, [query, selectedChip, ratingsByCafeId, tasteProfile, userLocation, cafeCatalog]);

  const showNoResults = results.length === 0;
  const resultsLabel = resultsHeadingLabel(selectedChip);

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {RANK_CHIPS.map((chip) => (
            <FilterChip
              key={chip.id}
              label={chip.label}
              icon={getSearchFilterIcon(chip.id) ?? undefined}
              selected={selectedChip === chip.id}
              onPress={() =>
                setSelectedChip((prev) => (prev === chip.id ? null : chip.id))
              }
            />
          ))}
        </ScrollView>

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
                    recommendationReason={
                      selectedChip === 'trending'
                        ? undefined
                        : getRecommendationReason(cafe, tasteProfile)
                    }
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
  chipsRow: {
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
    paddingRight: 8,
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
