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
import { cafes, type Cafe } from '@/data/cafes';
import { buildTasteProfileFromState, rankCafesForSearch, type RankKey } from '@/lib/cafeRanking';

import { CompactCafeCard } from './components/CompactCafeCard';
import { FilterChip } from './components/FilterChip';
import { COLORS } from './components/theme';

const RANK_CHIPS = [
  { id: 'work' as const, label: 'Best for Work' },
  { id: 'coffee' as const, label: 'Great Coffee' },
  { id: 'atmosphere' as const, label: 'Great Atmosphere' },
  { id: 'quick' as const, label: 'Quick' },
  { id: 'quiet' as const, label: 'Quiet' },
];

type ViewMode = 'list' | 'map';

function parseRankParam(raw: string | string[] | undefined): RankKey | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'work' || v === 'coffee' || v === 'atmosphere' || v === 'quiet' || v === 'quick') {
    return v;
  }
  return null;
}

function resultsHeadingLabel(selectedChip: RankKey | null): string {
  if (selectedChip === null) {
    return 'Top matches';
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
  const { ratingsByCafeId } = useCafeState();
  const [query, setQuery] = useState('');
  const [selectedChip, setSelectedChip] = useState<RankKey | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    const parsed = parseRankParam(rankParam);
    if (parsed !== null) {
      setSelectedChip(parsed);
    }
  }, [rankParam]);

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafes),
    [ratingsByCafeId]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rankCafesForSearch([...cafes], q, selectedChip, ratingsByCafeId, tasteProfile);
  }, [query, selectedChip, ratingsByCafeId, tasteProfile]);

  const showNoResults = results.length === 0;
  const resultsLabel = resultsHeadingLabel(selectedChip);

  const mapRegion = useMemo(() => regionForCafes(results), [results]);

  const isWeb = Platform.OS === 'web';
  let MapView: typeof import('react-native-maps').default | undefined;
  let Marker: typeof import('react-native-maps').Marker | undefined;
  let Callout: typeof import('react-native-maps').Callout | undefined;

  if (!isWeb) {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Callout = Maps.Callout;
  }

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
          ) : MapView && Marker && Callout ? (
            <MapView
              key={results.map((c) => c.id).join('-')}
              style={styles.map}
              initialRegion={mapRegion}
            >
              {results.map((cafe) => (
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
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
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
    backgroundColor: '#F7F3EE',
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 79, 0.35)',
  },
  viewToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  viewToggleLabelActive: {
    color: COLORS.roastedBrown,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 10,
  },
  resultsLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    paddingHorizontal: 20,
    paddingBottom: 28,
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
