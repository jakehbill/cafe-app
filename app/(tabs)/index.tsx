import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import type { Cafe } from '../../data/cafes';
import type { CafeRating } from '@/contexts/CafeStateContext';
import { BrandTopBar } from '@/components/BrandTopBar';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { formatTagLabel } from '@/lib/cafeTags';
import { buildTasteProfileFromState, rankCafesForHome } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';
import { PublicCoffeeScoreText } from '@/components/PublicCoffeeScoreText';
import { getTopCafeTags, supabase } from '@/lib/supabase';

const MAX_VISIBLE_TAGS = 3;

function HomeCafeCard({
  cafe,
  localRating,
  recommendationReason,
  isSaved,
  onPress,
  layout = 'stack',
}: {
  cafe: Cafe;
  localRating?: CafeRating;
  /** Shown under the name when set (personalized “why” line). */
  recommendationReason?: string | null;
  /** Used to show the correct saved state on first render. */
  isSaved?: boolean;
  onPress: () => void;
  /** Carousel: slightly larger type + image for editorial strip. */
  layout?: 'stack' | 'carousel';
}) {
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

  const isCarousel = layout === 'carousel';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={[styles.featuredCard, isCarousel && styles.featuredCardCarousel]}
      onPress={onPress}
    >
      {cafe.imageUrl ? (
        <Image
          source={{ uri: cafe.imageUrl }}
          style={[styles.featuredImagePlaceholder, isCarousel && styles.featuredImageCarousel]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.featuredImagePlaceholder, isCarousel && styles.featuredImageCarousel]} />
      )}

      <View style={[styles.featuredBody, isCarousel && styles.featuredBodyCarousel]}>
        <Text style={[styles.featuredName, isCarousel && styles.featuredNameCarousel]}>{cafe.name}</Text>
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

        {/* Same numeric line as CompactCafeCard (`PublicCoffeeScoreText`); avoid boxed flex row that hid the score on some layouts */}
        <View style={styles.homeScoresLine}>
          <PublicCoffeeScoreText cafe={cafe} />
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
  const { cafes: cafeCatalog } = useCafeCatalog();

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds]
  );

  /** Client-side ranking (same as Search with no query). Public coffee on cards comes from `cafe_public_scores` via catalog merge. */
  const topPicksForYou = useMemo(
    () => rankCafesForHome([...cafeCatalog], ratingsByCafeId, tasteProfile).slice(0, 5),
    [cafeCatalog, ratingsByCafeId, tasteProfile]
  );

  const { width: windowWidth } = useWindowDimensions();
  const picksCarousel = useMemo(() => {
    const peek = 28;
    const gap = 14;
    const cardWidth = Math.max(280, Math.min(windowWidth - 40 - peek, windowWidth * 0.88));
    const snapInterval = cardWidth + gap;
    return { cardWidth, gap, snapInterval };
  }, [windowWidth]);

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

  useEffect(() => {
    if (!__DEV__) return;
    const payload = {
      cafeCatalogCount: cafeCatalog.length,
      topPicksForYouCardCount: topPicksForYou.length,
    };
    try {
      console.log(`[DEBUG Home UI: final section counts]\n${JSON.stringify(payload, null, 2)}`);
    } catch {
      console.log('[DEBUG Home UI: final section counts]', payload);
    }
  }, [cafeCatalog.length, topPicksForYou.length]);

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
              <Text style={styles.swipeHint}>Swipe sideways for more</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              decelerationRate="fast"
              snapToInterval={picksCarousel.snapInterval}
              snapToAlignment="start"
              disableIntervalMomentum
              contentContainerStyle={styles.picksRowContent}
              style={styles.picksRow}
            >
              {topPicksForYou.map((cafe, index) => (
                <View
                  key={`pick-${cafe.id}`}
                  style={{
                    width: picksCarousel.cardWidth,
                    marginRight: index === topPicksForYou.length - 1 ? 0 : picksCarousel.gap,
                  }}
                >
                  <HomeCafeCard
                    cafe={cafe}
                    layout="carousel"
                    localRating={ratingsByCafeId[cafe.id]}
                    recommendationReason={getRecommendationReason(cafe, tasteProfile)}
                    isSaved={savedCafeIdSet.has(cafe.id)}
                    onPress={() => router.push(`/cafe/${cafe.id}`)}
                  />
                </View>
              ))}
            </ScrollView>
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
  homeSectionHeader: {
    gap: 6,
    marginBottom: 8,
    paddingTop: 2,
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
  swipeHint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    opacity: 0.85,
    marginTop: 2,
  },
  picksRow: {
    marginHorizontal: -20,
    marginTop: 4,
  },
  picksRowContent: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 4,
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
  featuredCardCarousel: {
    marginTop: 0,
  },
  featuredImagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.imagePlaceholder,
  },
  featuredImageCarousel: {
    aspectRatio: 4 / 3,
  },
  featuredBody: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 16,
  },
  featuredBodyCarousel: {
    paddingTop: 20,
    paddingBottom: 22,
    gap: 14,
  },
  featuredName: {
    fontSize: 22,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  featuredNameCarousel: {
    fontSize: 24,
    lineHeight: 30,
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
  homeScoresLine: {
    marginTop: 2,
    alignSelf: 'stretch',
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
