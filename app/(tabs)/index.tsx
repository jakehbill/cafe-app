import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
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
import { BrandTopBar } from '@/components/BrandTopBar';
import { CoffeeCupRating } from '@/components/CoffeeCupRating';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { useOptionalUserLocation } from '@/hooks/useOptionalUserLocation';
import { formatTagLabel } from '@/lib/cafeTags';
import {
  fetchTrendingGlobal,
  rankCafesForTrending,
} from '@/lib/cafeTrending';
import { buildTasteProfileFromState, rankCafesForHome } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';
import { getTopCafeTags, supabase } from '@/lib/supabase';

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
  const [topTags, setTopTags] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fetched = await getTopCafeTags(cafe.id, MAX_VISIBLE_TAGS);
      if (!cancelled) setTopTags(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe.id]);

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
            <CoffeeCupRating value={displayScores.coffee} size={16} />
          </View>
        </View>

        <View style={styles.featuredTagsRow}>
          {topTags.map((tag) => (
            <View key={tag} style={styles.featuredTag}>
              <Text style={styles.featuredTagText}>{formatTagLabel(tag)}</Text>
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
  const segments = useSegments();
  const navigation = useNavigation();
  const { ratingsByCafeId, visitedCafeIds, savedCafeIds } = useCafeState();

  useEffect(() => {
    if (!__DEV__) return;
    try {
      const parent = navigation.getParent();
      const rootState = parent?.getState?.();
      const rootRoute = rootState?.routes?.[rootState?.index ?? 0];
      console.log('[RouteHeaderDebug Home]', {
        segments,
        rootStackFocusedRouteName: rootRoute?.name,
      });
    } catch (e) {
      console.log('[RouteHeaderDebug Home] segments:', segments, 'err:', e);
    }
  }, [navigation, segments]);
  const userLocation = useOptionalUserLocation();
  const { cafes: cafeCatalog, byId } = useCafeCatalog();

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds]
  );

  /**
   * Top picks for you:
   * Home ranking is driven by the aggregated Supabase view `cafe_overall_ranking` (ratings, saves,
   * visits roll up into `overall_score`). Map ids → catalog `Cafe` rows for the card UI.
   * Fallback: client ranking over the catalog if the fetch fails or returns nothing.
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
          .select('*')
          .order('overall_score', { ascending: false })
          .limit(10);

        if (cancelled) return;

        if (res.error) {
          console.error('Home top picks fetch failed:', res.error);
          if (__DEV__) {
            const payload = {
              error: { message: res.error.message, code: res.error.code },
            };
            try {
              console.log(
                `[DEBUG Home cafe_overall_ranking]\n${JSON.stringify(payload, null, 2)}`
              );
            } catch {
              console.log('[DEBUG Home cafe_overall_ranking]', payload);
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
              `[DEBUG Home topPicks: cafe_overall_ranking query]\n${JSON.stringify(payload, null, 2)}`
            );
          } catch {
            console.log('[DEBUG Home topPicks: cafe_overall_ranking query]', payload);
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
          <BrandTopBar />

          <View style={styles.homeSection}>
            <View style={styles.homeSectionHeader}>
              <Text style={styles.homeSectionTitle}>Top picks for you</Text>
              <Text style={styles.homeSectionSubtitle}>Based on your taste</Text>
            </View>
            {topPicksLoading ? (
              <View style={styles.sectionLoadingRow}>
                <ActivityIndicator size="small" color={COLORS.muted} />
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
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 42,
  },
  topSection: {
    gap: 24,
  },
  homeSection: {
    gap: 18,
  },
  homeSectionTrending: {
    marginTop: 6,
    paddingTop: 26,
  },
  homeSectionHeader: {
    gap: 6,
    marginBottom: 8,
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
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
  },
  homeSectionTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  homeSectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.1,
  },
  featuredCard: {
    marginTop: 6,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  featuredImagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.imagePlaceholder,
  },
  featuredBody: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 16,
  },
  featuredName: {
    fontSize: 22,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  featuredReason: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    fontFamily: FONTS.sans.medium,
    marginTop: 2,
  },
  featuredNeighborhood: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
  },
  ratedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.coffeePillBackground,
    borderWidth: 1,
    borderColor: COLORS.coffeePillBorder,
    marginTop: -4,
  },
  ratedBadgeText: {
    fontSize: 12,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  equalScoresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  equalScoreBlock: {
    flex: 1,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  equalScoreLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  equalScoreValue: {
    fontSize: 27,
    fontFamily: FONTS.sans.bold,
    color: COLORS.text,
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
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  featuredTagText: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: FONTS.sans.medium,
  },
  featuredSummary: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
  },
});
