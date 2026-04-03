import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

import { getPrimaryPhotoUrl, type Cafe } from '../../data/cafes';
import type { CafeRating } from '@/contexts/CafeStateContext';
import { BrandTopBar } from '@/components/BrandTopBar';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { buildTasteProfileFromState, rankCafesForHome } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';
import { PublicCoffeeScoreText } from '@/components/PublicCoffeeScoreText';
import { getTopCafeTags } from '@/lib/supabase';

const MAX_VISIBLE_TAGS = 3;

/** Matches horizontal padding for header, section titles, and card content below. */
const SCREEN_HORIZONTAL_PADDING = 20;

function heroGradientId(cafeId: string): string {
  return `homeHero_${cafeId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/** Top band only: dark at the hero top edge, fading out so mid-image stays clean. */
function ImageHeroTopFade({ cafeId, width, height }: { cafeId: string; width: number; height: number }) {
  const gid = `${heroGradientId(cafeId)}_top`;
  if (width <= 0 || height <= 0) return null;
  return (
    <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0a0a0a" stopOpacity="0.38" />
          <Stop offset="0.58" stopColor="#0a0a0a" stopOpacity="0.07" />
          <Stop offset="1" stopColor="#0a0a0a" stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gid})`} />
    </Svg>
  );
}

/** Bottom band: preserves the previous full-hero bottom emphasis (transparent → mid → strong) within this strip. */
function ImageHeroBottomFade({ cafeId, width, height }: { cafeId: string; width: number; height: number }) {
  const gid = `${heroGradientId(cafeId)}_bot`;
  if (width <= 0 || height <= 0) return null;
  return (
    <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0a0a0a" stopOpacity="0" />
          <Stop offset="0.45" stopColor="#0a0a0a" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#0a0a0a" stopOpacity="0.78" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gid})`} />
    </Svg>
  );
}

function HomeCafeCard({
  cafe,
  localRating,
  recommendationReason,
  isSaved,
  onSavePress,
  distanceLabel,
  hoursLabel,
  onPress,
  layout = 'stack',
}: {
  cafe: Cafe;
  localRating?: CafeRating;
  recommendationReason?: string | null;
  isSaved?: boolean;
  onSavePress: () => void;
  /** E.g. "0.4 mi" when user location is available; omit when null. */
  distanceLabel?: string | null;
  /** Opening / open-until copy when backend provides it; omit when null. */
  hoursLabel?: string | null;
  onPress: () => void;
  layout?: 'stack' | 'carousel';
}) {
  const [topTags, setTopTags] = useState<string[]>([]);
  const [heroGSize, setHeroGSize] = useState({ w: 0, h: 0 });

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
  const primaryPhoto = getPrimaryPhotoUrl(cafe);

  const onShare = async () => {
    try {
      await Share.share({
        message: `${cafe.name} — ${cafe.neighborhood}`,
        title: cafe.name,
      });
    } catch {
      /* user dismissed share sheet */
    }
  };

  return (
    <Pressable accessibilityRole="button" style={[styles.featuredCard, isCarousel && styles.featuredCardCarousel]} onPress={onPress}>
      <View
        pointerEvents="box-none"
        style={[styles.heroWrap, isCarousel && styles.heroWrapCarousel]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setHeroGSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
        }}
      >
        {primaryPhoto ? (
          <Image source={{ uri: primaryPhoto }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroImageFallback]} />
        )}
        <View style={styles.heroGradientSlot} pointerEvents="none">
          {heroGSize.h > 0 && heroGSize.w > 0 ? (
            <>
              <View style={[styles.heroTopFadeSlot, { height: heroGSize.h * 0.38 }]}>
                <ImageHeroTopFade cafeId={cafe.id} width={heroGSize.w} height={heroGSize.h * 0.38} />
              </View>
              <View style={[styles.heroBottomFadeSlot, { height: heroGSize.h * 0.54 }]}>
                <ImageHeroBottomFade cafeId={cafe.id} width={heroGSize.w} height={heroGSize.h * 0.54} />
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.heroTopRight} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Saved' : 'Save cafe'}
            hitSlop={10}
            style={styles.heroIconFab}
            onPress={() => {
              onSavePress();
            }}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color="rgba(255,255,255,0.95)"
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this cafe"
            hitSlop={10}
            style={styles.heroIconFab}
            onPress={() => {
              void onShare();
            }}
          >
            <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.95)" />
          </Pressable>
        </View>

        {localRating ? (
          <View style={styles.heroStatusPills} pointerEvents="none">
            <View style={styles.heroMiniPill}>
              <Text style={styles.heroMiniPillText}>Rated by you</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.heroCoffeeScoreWrap} pointerEvents="none">
          <PublicCoffeeScoreText cafe={cafe} variant="overlay" />
        </View>

        <View style={styles.heroTextBlock} pointerEvents="none">
          <Text style={[styles.heroTitle, isCarousel && styles.heroTitleCarousel]} numberOfLines={2}>
            {cafe.name}
          </Text>
          <Text style={styles.heroLocation} numberOfLines={1}>
            {cafe.neighborhood}
          </Text>
          {distanceLabel ? (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {distanceLabel}
            </Text>
          ) : null}
          {hoursLabel ? (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {hoursLabel}
            </Text>
          ) : null}
        </View>
      </View>

        <View style={[styles.featuredBody, isCarousel && styles.featuredBodyCarousel]}>
        <View style={styles.tagsRow}>
          <View style={styles.tagsWithIcons}>
            {topTags.map((tag) => (
              <View key={tag} style={styles.tagWithIcon}>
                <TagWithOptionalIcon
                  tag={tag}
                  iconSize={14}
                  color={COLORS.roastedBrown}
                  textStyle={styles.tagWithIconLabel}
                  gap={5}
                />
              </View>
            ))}
          </View>
        </View>

        <Text numberOfLines={3} style={styles.featuredSummary}>
          {cafe.summary}
        </Text>

        {recommendationReason ? (
          <Text style={styles.insightLine} numberOfLines={2}>
            {recommendationReason}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const segments = useSegments();
  const navigation = useNavigation();
  const { ratingsByCafeId, visitedCafeIds, savedCafeIds, isSaved, toggleSaved } = useCafeState();

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
    const cardWidth = Math.max(
      280,
      Math.min(windowWidth - SCREEN_HORIZONTAL_PADDING * 2 - peek, windowWidth * 0.88)
    );
    const snapInterval = cardWidth + gap;
    return { cardWidth, gap, snapInterval };
  }, [windowWidth]);

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
                    isSaved={isSaved(cafe.id)}
                    onSavePress={() => void toggleSaved(cafe.id)}
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
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 42,
  },
  topSection: {
    gap: 14,
  },
  homeSection: {
    gap: 18,
  },
  homeSectionHeader: {
    gap: 6,
    marginBottom: 8,
    paddingTop: 0,
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
  picksRow: {
    marginHorizontal: -SCREEN_HORIZONTAL_PADDING,
    marginTop: 4,
  },
  picksRowContent: {
    paddingLeft: SCREEN_HORIZONTAL_PADDING,
    paddingRight: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 4,
  },
  featuredCard: {
    marginTop: 6,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.none,
  },
  featuredCardCarousel: {
    marginTop: 0,
  },
  heroWrap: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.imagePlaceholder,
    overflow: 'hidden',
  },
  heroWrapCarousel: {
    aspectRatio: 4 / 3,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroImageFallback: {
    backgroundColor: COLORS.imagePlaceholder,
  },
  heroGradientSlot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroTopFadeSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  heroBottomFadeSlot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  heroTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroStatusPills: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '72%',
  },
  heroMiniPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.26)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  heroMiniPillText: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: 'rgba(255,255,255,0.93)',
    letterSpacing: -0.08,
  },
  heroCoffeeScoreWrap: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    zIndex: 2,
  },
  heroTextBlock: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 2,
    gap: 4,
    /** Keeps long titles from running under the floating score badge (bottom-right). */
    paddingRight: 54,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: FONTS.display.semibold,
    color: '#faf8f5',
    lineHeight: 28,
    letterSpacing: -0.35,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroTitleCarousel: {
    fontSize: 24,
    lineHeight: 30,
  },
  heroLocation: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: 'rgba(250,248,245,0.88)',
    letterSpacing: -0.05,
  },
  heroMeta: {
    fontSize: 12,
    fontFamily: FONTS.sans.regular,
    color: 'rgba(250,248,245,0.78)',
  },
  featuredBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
    backgroundColor: COLORS.cardBackground,
  },
  featuredBodyCarousel: {
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  tagsWithIcons: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tagWithIconLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
    letterSpacing: -0.1,
  },
  featuredSummary: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
  },
  insightLine: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.sans.regular,
    fontStyle: 'italic',
    color: COLORS.roastedBrown,
    opacity: 0.92,
  },
});
