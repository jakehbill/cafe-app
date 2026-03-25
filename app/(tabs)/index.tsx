import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Cafe } from '../../data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { useOptionalUserLocation } from '@/hooks/useOptionalUserLocation';
import {
  fetchTrendingGlobal,
  rankCafesForTrending,
} from '@/lib/cafeTrending';
import { buildTasteProfileFromState, rankCafesForHome } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';
import { supabase } from '@/lib/supabase';

const MAX_VISIBLE_TAGS = 3;

function getVisibleTags(tags: string[]) {
  return tags.slice(0, MAX_VISIBLE_TAGS);
}

/** Ranking views may use `cafe_id` (text/uuid) or numeric `id` — normalize so `byId` lookup matches `cafes`. */
function cafeIdFromViewRow(r: unknown): string | null {
  const row = r as Record<string, unknown>;
  const v =
    typeof row.cafe_id === 'string'
      ? row.cafe_id
      : row.cafe_uuid ?? row.id ?? row.cafe_id;
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
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
      {cafe.imageUrl ? (
        <Image
          source={{ uri: cafe.imageUrl }}
          style={styles.featuredImagePlaceholder}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.featuredImagePlaceholder} />
      )}

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
  const { cafes: cafeCatalog, byId } = useCafeCatalog();

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds]
  );

  /**
   * Top picks for you:
   * - Prefer `cafe_ranking`, else `cafe_overall_ranking`.
   * - `.order()` must use the real column name from each view (`cafe_ranking` uses `score` here).
   * - Map ids → rows from Supabase `cafes` (via catalog) for the `Cafe` UI shape.
   * - Fallback: client ranking over the catalog if the fetch fails or returns nothing.
   */
  const [topPickIds, setTopPickIds] = useState<string[] | null>(null);
  const [topPicksLoading, setTopPicksLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTopPicks() {
      setTopPicksLoading(true);
      try {
        let res = await supabase
          .from('cafe_ranking')
          .select('*')
          // PostgREST returns 400 if this string is not an exposed column on the view.
          .order('score', { ascending: false })
          .limit(10);

        if (res.error) {
          res = await supabase
            .from('cafe_overall_ranking')
            .select('*')
            .order('overall_score', { ascending: false })
            .limit(10);
        }

        if (cancelled) return;

        if (res.error) {
          console.error('Home top picks fetch failed:', res.error);
          if (__DEV__) {
            const payload = {
              error: { message: res.error.message, code: res.error.code },
            };
            try {
              console.log(
                `[DEBUG Home cafe_ranking / cafe_overall_ranking]\n${JSON.stringify(payload, null, 2)}`
              );
            } catch {
              console.log('[DEBUG Home cafe_ranking / cafe_overall_ranking]', payload);
            }
          }
          setTopPickIds(null);
          return;
        }

        const ids = (res.data ?? [])
          .map((r) => cafeIdFromViewRow(r))
          .filter((id): id is string => id != null);

        if (__DEV__) {
          const sample = (res.data ?? [])[0];
          const payload = {
            error: null,
            rawRowCount: (res.data ?? []).length,
            firstRawRow: sample ?? null,
            firstViewRowKeys: sample != null ? Object.keys(sample as object) : [],
            resolvedIdStrings: ids.length,
            resolvedIdsSample: ids.slice(0, 5),
            diagnosis:
              (res.data ?? []).length > 0 && ids.length === 0
                ? 'ID_EXTRACTION_FAIL: view has rows but cafeIdFromViewRow returned none'
                : null,
          };
          try {
            console.log(
              `[DEBUG Home topPicks: cafe_ranking query]\n${JSON.stringify(payload, null, 2)}`
            );
          } catch {
            console.log('[DEBUG Home topPicks: cafe_ranking query]', payload);
          }
        }

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
      const picked = topPickIds.map((id) => byId[id]).filter((c): c is Cafe => c != null);
      if (picked.length > 0) {
        return picked;
      }
    }
    return rankCafesForHome([...cafeCatalog], ratingsByCafeId, tasteProfile);
  }, [topPickIds, byId, cafeCatalog, ratingsByCafeId, tasteProfile]);

  useEffect(() => {
    if (!__DEV__ || !topPickIds?.length) return;
    const missing = topPickIds.filter((id) => !byId[id]);
    const payload = {
      rankingViewIdCount: topPickIds.length,
      catalogByIdKeyCount: Object.keys(byId).length,
      joinedCardCount: topPickIds.filter((id) => byId[id]).length,
      missingInCatalogSample: missing.slice(0, 10),
      catalogIdSample: Object.keys(byId).slice(0, 10),
      likelyIssue:
        topPickIds.length > 0 && missing.length === topPickIds.length
          ? 'ID_MISMATCH: every ranking id missing from catalog (format or wrong table join)'
          : missing.length > 0
            ? 'PARTIAL_ID_MISMATCH: some ranking ids not in catalog'
            : null,
    };
    try {
      console.log(
        `[DEBUG Home topPicks: view ids ↔ catalog byId]\n${JSON.stringify(payload, null, 2)}`
      );
    } catch {
      console.log('[DEBUG Home topPicks: view ids ↔ catalog byId]', payload);
    }
  }, [topPickIds, byId]);

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
   * - Uses the `cafe_trending` view (already ranked by `trending_score`).
   * - Maps ids → Supabase `cafes` rows for display.
   */
  const [trendingNearby, setTrendingNearby] = useState<Cafe[]>([]);
  // Trending section now renders from the ranked `trending` data source (nearby → global fallback).
  const trending = trendingNearby;

  useEffect(() => {
    if (!__DEV__) return;
    const payload = {
      cafeCatalogCount: cafeCatalog.length,
      topPickIdsFromView: topPickIds?.length ?? 0,
      topPicksForYouCardCount: topPicksForYou.length,
      trendingCardCount: trending.length,
    };
    try {
      console.log(`[DEBUG Home UI: final section counts]\n${JSON.stringify(payload, null, 2)}`);
    } catch {
      console.log('[DEBUG Home UI: final section counts]', payload);
    }
  }, [cafeCatalog.length, topPickIds, topPicksForYou.length, trending.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrending() {
      try {
        // Fetch ranked trending rows from Supabase view (no raw `cafes` table read here).
        const rows = await fetchTrendingGlobal();

        if (cancelled) return;

        const ids = (rows ?? [])
          .map((r) => cafeIdFromViewRow(r))
          .filter((id): id is string => id != null);

        const next = ids.map((id: string) => byId[id]).filter((c: Cafe | undefined): c is Cafe => c != null);

        if (__DEV__) {
          const missingTrend = ids.filter((id) => !byId[id]);
          const payload = {
            rawViewRowCount: (rows ?? []).length,
            resolvedIdStrings: ids.length,
            idsSample: ids.slice(0, 5),
            joinedCardCount: next.length,
            missingInCatalogSample: missingTrend.slice(0, 10),
            catalogCountAtJoin: cafeCatalog.length,
            diagnosis:
              (rows ?? []).length > 0 && ids.length === 0
                ? 'ID_EXTRACTION_FAIL from trending view rows'
                : ids.length > 0 && next.length === 0
                  ? 'ID_MISMATCH: trending ids not in catalog byId'
                  : null,
          };
          try {
            console.log(
              `[DEBUG Home trending: cafe_trending ↔ catalog]\n${JSON.stringify(payload, null, 2)}`
            );
          } catch {
            console.log('[DEBUG Home trending: cafe_trending ↔ catalog]', payload);
          }
        }

        // If views return ids not yet in catalog, fall back to a catalog-only trending sort.
        setTrendingNearby(next.length > 0 ? next : rankCafesForTrending([...cafeCatalog]));
      } catch (e) {
        if (!cancelled) {
          console.error('Home trending fetch failed:', e);
          setTrendingNearby(rankCafesForTrending([...cafeCatalog]));
        }
      }
    }

    void loadTrending();
    return () => {
      cancelled = true;
    };
  }, [userLocation, byId, cafeCatalog]);

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
