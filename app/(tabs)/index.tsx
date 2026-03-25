import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { cafes, type Cafe } from '../../data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useOptionalUserLocation } from '@/hooks/useOptionalUserLocation';
import {
  fetchTrendingGlobal,
  fetchTrendingNearby,
  rankCafesForTrending,
} from '@/lib/cafeTrending';
import { buildTasteProfileFromState, rankCafesForHome } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';
import { supabase } from '@/lib/supabase';

const MAX_VISIBLE_TAGS = 3;

function getVisibleTags(tags: string[]) {
  return tags.slice(0, MAX_VISIBLE_TAGS);
}

function HomeCafeCard({
  cafe,
  localRating,
  recommendationReason,
  isSaved,
  onPress,
}: {
  cafe: Cafe;
  localRating?: {
    coffee: number;
    work: number;
    vibe: number;
  };
  /** Shown under the name when set (personalized “why” line). */
  recommendationReason?: string | null;
  /** Used to show the correct saved state on first render. */
  isSaved?: boolean;
  onPress: () => void;
}) {
  const displayScores = localRating
    ? {
        coffee: localRating.coffee,
        work: localRating.work,
        vibe: localRating.vibe,
      }
    : {
        coffee: cafe.coffeeScore,
        work: cafe.workScore,
        vibe: cafe.vibeScore,
      };

  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.featuredCard} onPress={onPress}>
      <View style={styles.featuredImagePlaceholder} />

      <View style={styles.featuredBody}>
        <Text style={styles.featuredName}>{cafe.name}</Text>
        {recommendationReason ? (
          <Text style={styles.featuredReason} numberOfLines={1}>
            {recommendationReason}
          </Text>
        ) : null}
        <Text style={styles.featuredNeighborhood}>{cafe.neighborhood}</Text>
        {isSaved ? (
          <View style={styles.ratedBadge}>
            <Text style={styles.ratedBadgeText}>Saved</Text>
          </View>
        ) : null}
        {localRating ? (
          <View style={styles.ratedBadge}>
            <Text style={styles.ratedBadgeText}>Rated by you</Text>
          </View>
        ) : null}

        <View style={styles.equalScoresRow}>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Coffee</Text>
            <Text style={styles.equalScoreValue}>{displayScores.coffee.toFixed(1)}</Text>
          </View>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Work</Text>
            <Text style={styles.equalScoreValue}>{displayScores.work.toFixed(1)}</Text>
          </View>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Vibe</Text>
            <Text style={styles.equalScoreValue}>{displayScores.vibe.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.featuredTagsRow}>
          {getVisibleTags(cafe.tags).map((tag) => (
            <View key={tag} style={styles.featuredTag}>
              <Text style={styles.featuredTagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text numberOfLines={2} style={styles.featuredSummary}>
          {cafe.summary}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { ratingsByCafeId, visitedCafeIds, savedCafeIds } = useCafeState();
  const userLocation = useOptionalUserLocation();

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafes, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, visitedCafeIds, savedCafeIds]
  );

  /**
   * Top picks for you:
   * - Primary: fetch Top 10 cafe ids from `cafe_overall_ranking` (overall_score desc).
   * - Then map ids → local cafe objects for a stable UI shape (`Cafe` type).
   * - Fallback: local ranking if the fetch fails or returns nothing.
   */
  const [topPickIds, setTopPickIds] = useState<string[] | null>(null);
  const [topPicksLoading, setTopPicksLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTopPicks() {
      setTopPicksLoading(true);
      try {
        const res = await supabase
          .from('cafe_overall_ranking')
          .select('cafe_id')
          .order('overall_score', { ascending: false })
          .limit(10);

        if (cancelled) return;

        if (res.error) {
          console.error('Home top picks fetch failed:', res.error);
          setTopPickIds(null);
          return;
        }

        const ids = (res.data ?? [])
          .map((r) => r.cafe_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);

        setTopPickIds(ids.length > 0 ? ids : null);
      } catch (e) {
        if (!cancelled) {
          console.error('Home top picks fetch failed (unexpected):', e);
          setTopPickIds(null);
        }
      } finally {
        if (!cancelled) {
          setTopPicksLoading(false);
        }
      }
    }

    void loadTopPicks();
    return () => {
      cancelled = true;
    };
  }, []);

  const topPicksForYou = useMemo(() => {
    if (topPickIds && topPickIds.length > 0) {
      const byId = Object.fromEntries(cafes.map((c) => [c.id, c] as const));
      const picked = topPickIds.map((id) => byId[id]).filter((c): c is Cafe => c != null);
      if (picked.length > 0) {
        return picked;
      }
    }
    return rankCafesForHome([...cafes], ratingsByCafeId, tasteProfile);
  }, [topPickIds, ratingsByCafeId, tasteProfile]);

  /**
   * Load the user’s saved cafes so cards can reflect saved state immediately.
   * We only select `cafe_id` and store it as a Set for fast lookups.
   */
  const [savedCafeIdSet, setSavedCafeIdSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          console.error('Home saved cafes: auth getUser failed:', userErr);
          return;
        }

        const userId = userRes.user?.id;
        if (!userId) {
          // Not signed in — leave the Set empty and keep the UI calm.
          if (!cancelled) setSavedCafeIdSet(new Set());
          return;
        }

        const res = await supabase.from('saves').select('cafe_id').eq('user_id', userId);
        if (res.error) {
          console.error('Home saved cafes: fetch failed:', res.error);
          return;
        }

        const next = new Set(
          (res.data ?? [])
            .map((r: any) => r?.cafe_id)
            .filter((v: any) => v !== null && v !== undefined)
            .map((v: any) => String(v))
        );

        if (!cancelled) setSavedCafeIdSet(next);
      } catch (e) {
        console.error('Home saved cafes: fetch failed (unexpected):', e);
      }
    }

    void loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Trending section:
   * - If we have location, ask the backend for trending *nearby*.
   * - If not, fall back to the global trending view.
   */
  const [trendingNearby, setTrendingNearby] = useState<Cafe[]>(() =>
    rankCafesForTrending([...cafes])
  );
  // Trending section now renders from the ranked `trending` data source (nearby → global fallback).
  const trending = trendingNearby;

  useEffect(() => {
    let cancelled = false;

    async function loadTrending() {
      try {
        const lat = userLocation?.latitude;
        const lng = userLocation?.longitude;

        // Location-aware first; otherwise global fallback.
        const rows =
          typeof lat === 'number' && typeof lng === 'number'
            ? await fetchTrendingNearby({ userLat: lat, userLng: lng, radiusMiles: 0.5 })
            : await fetchTrendingGlobal();

        if (cancelled) return;

        const byId = Object.fromEntries(cafes.map((c) => [c.id, c] as const));
        const ids = (rows ?? [])
          .map((r: any) => (typeof r?.cafe_id === 'string' ? r.cafe_id : r?.id))
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

        const next = ids.map((id: string) => byId[id]).filter((c: Cafe | undefined): c is Cafe => c != null);

        // If the backend returns no matching ids, keep a stable local fallback.
        setTrendingNearby(next.length > 0 ? next : rankCafesForTrending([...cafes]));
      } catch (e) {
        if (!cancelled) {
          console.error('Home trending fetch failed:', e);
          setTrendingNearby(rankCafesForTrending([...cafes]));
        }
      }
    }

    void loadTrending();
    return () => {
      cancelled = true;
    };
  }, [userLocation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topSection}>
          <View style={styles.homeTopBar}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push('/search')}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.searchAllLink}>Search all cafes</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.testAuthButton}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.testAuthButtonText}>Test Auth</Text>
          </TouchableOpacity>

          <View style={styles.homeSection}>
            <View style={styles.homeSectionHeader}>
              <Text style={styles.homeSectionTitle}>Top picks for you</Text>
              <Text style={styles.homeSectionSubtitle}>Based on your taste</Text>
            </View>
            {topPicksLoading ? (
              <View style={styles.sectionLoadingRow}>
                <ActivityIndicator size="small" color="#8A6A4F" />
                <Text style={styles.sectionLoadingText}>Loading picks…</Text>
              </View>
            ) : null}
            {topPicksForYou.map((cafe) => (
              <HomeCafeCard
                key={`pick-${cafe.id}`}
                cafe={cafe}
                localRating={ratingsByCafeId[cafe.id]}
                recommendationReason={getRecommendationReason(cafe, tasteProfile)}
                isSaved={savedCafeIdSet.has(cafe.id)}
                onPress={() => router.push(`/cafe/${cafe.id}`)}
              />
            ))}
          </View>

          <View style={[styles.homeSection, styles.homeSectionTrending]}>
            <View style={styles.homeSectionHeader}>
              <Text style={styles.homeSectionTitle}>Trending nearby</Text>
              <Text style={styles.homeSectionSubtitle}>Popular right now</Text>
            </View>
            {trending.map((cafe) => (
              <HomeCafeCard
                key={`trend-${cafe.id}`}
                cafe={cafe}
                localRating={ratingsByCafeId[cafe.id]}
                isSaved={savedCafeIdSet.has(cafe.id)}
                onPress={() => router.push(`/cafe/${cafe.id}`)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F3EE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  topSection: {
    gap: 20,
  },
  homeTopBar: {
    alignItems: 'flex-end',
    marginBottom: -4,
  },
  searchAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A6A4F',
    letterSpacing: -0.15,
  },
  homeSection: {
    gap: 14,
  },
  homeSectionTrending: {
    marginTop: 4,
    paddingTop: 22,
  },
  homeSectionHeader: {
    gap: 5,
    marginBottom: 6,
    paddingTop: 2,
  },
  sectionLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
  },
  sectionLoadingText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#8A8278',
    fontWeight: '600',
  },
  homeSectionTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
    color: '#2E2A27',
    letterSpacing: -0.4,
  },
  homeSectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#8A8278',
    letterSpacing: -0.1,
  },
  testAuthButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#F2EBDD',
    borderWidth: 1,
    borderColor: '#E7DDCD',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  testAuthButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E2A27',
  },

  featuredCard: {
    marginTop: 6,
    backgroundColor: '#F7F3EE',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE4D6',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  featuredImagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: '#E9E2D6',
  },
  featuredBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
  },
  featuredName: {
    fontSize: 21,
    fontWeight: '700',
    color: '#2E2A27',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  featuredReason: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6E6254',
    fontWeight: '500',
    marginTop: 2,
  },
  featuredNeighborhood: {
    fontSize: 13,
    color: '#6E6254',
    lineHeight: 18,
  },
  ratedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(163, 177, 138, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.45)',
    marginTop: -4,
  },
  ratedBadgeText: {
    fontSize: 12,
    color: '#4A5A49',
    fontWeight: '600',
  },
  equalScoresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  equalScoreBlock: {
    flex: 1,
    backgroundColor: '#F1E9DC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7DDCD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  equalScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F5346',
  },
  equalScoreValue: {
    fontSize: 27,
    fontWeight: '700',
    color: '#2E2A27',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  featuredTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  featuredTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8F5F0',
    borderWidth: 1,
    borderColor: '#ECE2D3',
  },
  featuredTagText: {
    color: '#5E5348',
    fontSize: 12,
    fontWeight: '500',
  },
  featuredSummary: {
    color: '#4F4740',
    fontSize: 14,
    lineHeight: 22,
  },
});
