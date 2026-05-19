import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { type Cafe } from '../../data/cafes';
import type { CafeRating } from '@/contexts/CafeStateContext';
import { BrandTopBar } from '@/components/BrandTopBar';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { useCafesWithApprovedPhotos } from '@/hooks/useCafesWithApprovedPhotos';
import { useOnboardingPreferencesForRanking } from '@/hooks/useOnboardingPreferencesForRanking';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { buildTasteProfileFromState, rankCafesForHome } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';
import { buildCafeShareMessage } from '@/lib/cafeShareMessage';
import { formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';
import { getRecentPublicVisitNotes, resolveCafeDisplayTags, supabase, type PublicVisitNote } from '@/lib/supabase';
import { getNearbyCafesWithinRadius } from '@/lib/cafeNearby';
import {
  composeTrendingNearbyForUser,
  rankCafesForTrending,
  rankNearbyPoolForTrending,
} from '@/lib/cafeTrending';
import { withCafeDistances } from '@/lib/cafeDistance';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { CAFE_PLACEHOLDER_IMAGE_URL, resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';

const MAX_VISIBLE_TAGS = 3;
const HOME_ONBOARDING_BANNER_DISMISSED_KEY = 'home_onboarding_banner_dismissed_v1';

/** Matches horizontal padding for header, section titles, and card content below. */
const SCREEN_HORIZONTAL_PADDING = 20;
const NOTICE_BOARD_LIMIT = 5;

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
      const fetched = await resolveCafeDisplayTags(cafe, MAX_VISIBLE_TAGS);
      if (!cancelled) setTopTags(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe.id, cafe.tags]);

  const isCarousel = layout === 'carousel';
  const primaryPhoto = resolveLiveCafePrimaryImageUrl({ cafe });
  const scoreLabel = formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
  const hasTopTags = topTags.length > 0;
  const areaText = (cafe.neighborhood ?? '').trim();

  const onShare = async () => {
    try {
      await Share.share({
        message: buildCafeShareMessage(cafe),
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

        <View style={styles.heroTextBlock} pointerEvents="none">
          <Text style={[styles.heroTitle, isCarousel && styles.heroTitleCarousel]} numberOfLines={2}>
            {cafe.name}
          </Text>
          <Text style={styles.heroLocation} numberOfLines={1}>
            <Text style={styles.heroLocationScore}>{scoreLabel}</Text>
            {areaText ? (
              <>
                <Text style={styles.heroLocationDot}> {'\u00b7'} </Text>
                <Text>{areaText}</Text>
              </>
            ) : null}
            {distanceLabel ? (
              <>
                <Text style={styles.heroLocationDot}> {'\u2022'} </Text>
                <Text>{distanceLabel}</Text>
              </>
            ) : null}
          </Text>
          {hoursLabel ? (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {hoursLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.featuredBody, isCarousel && styles.featuredBodyCarousel, !hasTopTags && styles.featuredBodyNoTags]}>
        {hasTopTags ? (
          <View style={styles.tagsWithIcons}>
            {topTags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <TagWithOptionalIcon
                  tag={tag}
                  iconSize={12}
                  color={COLORS.muted}
                  textStyle={styles.tagChipLabel}
                  gap={5}
                />
              </View>
            ))}
          </View>
        ) : null}

        <Text numberOfLines={3} style={styles.featuredSummary}>
          {cafe.short_description}
        </Text>

        {recommendationReason ? (
          <View style={styles.insightLineWrap}>
            <Text style={styles.insightLine} numberOfLines={2}>
              {recommendationReason}
            </Text>
          </View>
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
  const { cafes: cafeCatalog, refetch: refetchCafeCatalog } = useCafeCatalog();
  const cafesWithApprovedPhotos = useCafesWithApprovedPhotos(cafeCatalog);
  const { coords: userLocation, refreshLocation } = useUserLocation();
  const onboardingPrefs = useOnboardingPreferencesForRanking();
  const [homeBannerVisible, setHomeBannerVisible] = useState(false);
  const [homeBannerPrefLoaded, setHomeBannerPrefLoaded] = useState(false);
  const [noticeBoardNotes, setNoticeBoardNotes] = useState<PublicVisitNote[]>([]);
  const [visitedFromVisitLogs, setVisitedFromVisitLogs] = useState<Set<string>>(new Set());

  const loadNoticeBoard = React.useCallback(async () => {
    const rows = await getRecentPublicVisitNotes(NOTICE_BOARD_LIMIT);
    if (__DEV__) {
      console.log('[NoticeBoard] home load rows:', rows.length);
    }
    setNoticeBoardNotes(rows);
  }, []);

  const loadVisitedCafeIdsFromVisitLogs = React.useCallback(async () => {
    const auth = await supabase.auth.getUser();
    const userId = auth.data.user?.id ?? null;
    if (!userId) {
      setVisitedFromVisitLogs(new Set());
      return;
    }

    const res = await supabase
      .from('user_cafe_visits')
      .select('cafe_id')
      .eq('user_id', userId)
      .not('cafe_id', 'is', null);

    if (res.error) {
      console.error('Failed to load visited cafes from visit logs:', res.error);
      return;
    }

    const ids = new Set(
      (res.data ?? [])
        .map((row) => String((row as { cafe_id?: unknown }).cafe_id ?? '').trim())
        .filter((id) => id.length > 0)
    );
    setVisitedFromVisitLogs(ids);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dismissed = await AsyncStorage.getItem(HOME_ONBOARDING_BANNER_DISMISSED_KEY);
        if (cancelled) return;
        setHomeBannerVisible(dismissed !== '1');
      } finally {
        if (!cancelled) setHomeBannerPrefLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismissHomeBanner() {
    setHomeBannerVisible(false);
    try {
      await AsyncStorage.setItem(HOME_ONBOARDING_BANNER_DISMISSED_KEY, '1');
    } catch {
      // Keep UX smooth; missing persistence only means banner may reappear later.
    }
  }

  useEffect(() => {
    // Refresh once on Home mount; avoids stale distance labels after app resume.
    void refreshLocation();
  }, [refreshLocation]);

  useEffect(() => {
    void loadNoticeBoard();
  }, [loadNoticeBoard]);

  useEffect(() => {
    void loadVisitedCafeIdsFromVisitLogs();
  }, [loadVisitedCafeIdsFromVisitLogs]);

  useFocusEffect(
    React.useCallback(() => {
      // Home cards use signed URLs for approved photos; refresh on focus to keep URLs fresh.
      void refetchCafeCatalog();
      void loadNoticeBoard();
      void loadVisitedCafeIdsFromVisitLogs();
    }, [refetchCafeCatalog, loadNoticeBoard, loadVisitedCafeIdsFromVisitLogs])
  );

  const cafesWithDistance = useMemo(
    () => withCafeDistances(cafesWithApprovedPhotos, userLocation),
    [cafesWithApprovedPhotos, userLocation]
  );

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafesWithDistance, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, cafesWithDistance, visitedCafeIds, savedCafeIds]
  );

  /**
   * Top picks remain preference-led.
   * Distance adds only a small modifier so nearby options get a modest nudge, not a takeover.
   */
  const topPicksForYou = useMemo(() => {
    const base = rankCafesForHome([...cafesWithDistance], ratingsByCafeId, tasteProfile, onboardingPrefs);
    const baseRank = new Map(base.map((cafe, index) => [cafe.id, index]));
    const rescored = [...base].sort((a, b) => {
      const aBase = baseRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bBase = baseRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      const aDistanceBoost = a.distanceMiles == null ? 0 : Math.max(0, 1 - a.distanceMiles / 6) * 0.35;
      const bDistanceBoost = b.distanceMiles == null ? 0 : Math.max(0, 1 - b.distanceMiles / 6) * 0.35;
      // Lower index is better; subtract small distance boost.
      return (aBase - aDistanceBoost) - (bBase - bDistanceBoost);
    });
    if (visitedFromVisitLogs.size === 0) {
      return rescored.slice(0, 5);
    }
    const unvisited = rescored.filter((cafe) => !visitedFromVisitLogs.has(String(cafe.id).trim()));
    return unvisited.slice(0, 5);
  }, [cafesWithDistance, ratingsByCafeId, tasteProfile, onboardingPrefs, visitedFromVisitLogs]);

  const fallbackHighRatedCafes = useMemo(() => {
    const copy = [...cafesWithDistance];
    copy.sort((a, b) => {
      const aPublic = a.publicCoffeeScore ?? -1;
      const bPublic = b.publicCoffeeScore ?? -1;
      if (bPublic !== aPublic) return bPublic - aPublic;
      return b.coffeeScore - a.coffeeScore;
    });
    return copy.slice(0, 5);
  }, [cafesWithDistance]);

  const knownCafeIdsForTrending = useMemo(() => {
    const known = new Set<string>();
    for (const id of visitedCafeIds) {
      const key = String(id).trim();
      if (key) known.add(key);
    }
    for (const id of visitedFromVisitLogs) {
      const key = String(id).trim();
      if (key) known.add(key);
    }
    for (const id of savedCafeIds) {
      const key = String(id).trim();
      if (key) known.add(key);
    }
    for (const id of Object.keys(ratingsByCafeId)) {
      const key = String(id).trim();
      if (key) known.add(key);
    }
    return known;
  }, [visitedCafeIds, visitedFromVisitLogs, savedCafeIds, ratingsByCafeId]);

  const trendingNearby = useMemo(() => {
    const targetCount = 5;
    if (!userLocation) {
      // Permission denied/unavailable path: keep Home usable with non-distance fallback.
      const ranked = rankCafesForTrending([...cafesWithDistance]);
      return {
        cafes: composeTrendingNearbyForUser(ranked, {
          limit: targetCount,
          knownCafeIds: knownCafeIdsForTrending,
        }),
        activeRadiusMiles: null as number | null,
        prefersDiscovery: knownCafeIdsForTrending.size > 0,
      };
    }

    const radiusSteps = [1, 2, 3];
    let pool: Cafe[] = [];
    let activeRadius = radiusSteps[radiusSteps.length - 1];
    for (const radius of radiusSteps) {
      const inRadius = getNearbyCafesWithinRadius(cafesWithDistance, userLocation, radius);
      if (inRadius.length > 0) pool = inRadius;
      if (inRadius.length >= targetCount) {
        pool = inRadius;
        activeRadius = radius;
        break;
      }
      activeRadius = radius;
    }
    if (pool.length === 0) {
      return {
        cafes: composeTrendingNearbyForUser(fallbackHighRatedCafes, {
          limit: targetCount,
          knownCafeIds: knownCafeIdsForTrending,
        }),
        activeRadiusMiles: null as number | null,
        prefersDiscovery: knownCafeIdsForTrending.size > 0,
      };
    }

    const rankedNearby = rankNearbyPoolForTrending(pool, activeRadius);
    return {
      cafes: composeTrendingNearbyForUser(rankedNearby, {
        limit: targetCount,
        knownCafeIds: knownCafeIdsForTrending,
      }),
      activeRadiusMiles: activeRadius,
      prefersDiscovery: knownCafeIdsForTrending.size > 0,
    };
  }, [cafesWithDistance, fallbackHighRatedCafes, knownCafeIdsForTrending, userLocation]);

  const trendingSubtitle = useMemo(() => {
    if (!userLocation) {
      return trendingNearby.prefersDiscovery ? 'Mostly new spots for you' : 'Popular right now';
    }
    if (trendingNearby.activeRadiusMiles == null) {
      return trendingNearby.prefersDiscovery ? 'Mostly new spots near you' : 'Popular around you';
    }
    const radius = `Within ${trendingNearby.activeRadiusMiles} mi`;
    return trendingNearby.prefersDiscovery
      ? `Mostly new spots near you · ${radius}`
      : `Popular around you · ${radius}`;
  }, [trendingNearby.activeRadiusMiles, trendingNearby.prefersDiscovery, userLocation]);

  const noticeBoardRows = useMemo(() => {
    const cafeById = new Map(cafesWithApprovedPhotos.map((cafe) => [String(cafe.id).trim(), cafe]));
    return noticeBoardNotes.map((row) => {
      const cafe = row.cafeId ? cafeById.get(String(row.cafeId).trim()) : null;
      const thumbnailUrl = cafe
        ? resolveLiveCafePrimaryImageUrl({ cafe })
        : CAFE_PLACEHOLDER_IMAGE_URL;
      return {
        ...row,
        thumbnailUrl: thumbnailUrl || CAFE_PLACEHOLDER_IMAGE_URL,
      };
    });
  }, [noticeBoardNotes, cafesWithApprovedPhotos]);

  const { width: windowWidth } = useWindowDimensions();
  const picksCarousel = useMemo(() => {
    const cardWidthRatio = 0.84;
    const peek = 26;
    const gap = 14;
    const cardWidth = Math.max(
      260,
      Math.min(windowWidth * cardWidthRatio, windowWidth - SCREEN_HORIZONTAL_PADDING * 2 - peek)
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
          {homeBannerPrefLoaded && homeBannerVisible ? (
            <View style={styles.onboardingBanner}>
              <View style={styles.onboardingBannerTextWrap}>
                <Text style={styles.onboardingBannerTitle}>Welcome to Beaned</Text>
                <Text style={styles.onboardingBannerBody}>
                  Discover great coffee and work-friendly cafes. Save, visit and rate to get better picks.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss welcome banner"
                onPress={() => void dismissHomeBanner()}
                hitSlop={8}
                style={styles.onboardingBannerDismiss}
              >
                <Ionicons name="close" size={16} color={COLORS.muted} />
              </Pressable>
            </View>
          ) : null}

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
                    distanceLabel={cafe.distanceLabel ?? null}
                    onSavePress={() => void toggleSaved(cafe.id)}
                    onPress={() => router.push(`/cafe/${cafe.id}`)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.homeSection}>
            <View style={styles.homeSectionHeader}>
              <Text style={styles.secondarySectionTitle}>Worth trying nearby</Text>
              <Text style={styles.secondarySectionSubtitle}>{trendingSubtitle}</Text>
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
              {trendingNearby.cafes.map((cafe, index) => (
                <View
                  key={`trending-${cafe.id}`}
                  style={{
                    width: picksCarousel.cardWidth,
                    marginRight: index === trendingNearby.cafes.length - 1 ? 0 : picksCarousel.gap,
                  }}
                >
                  <HomeCafeCard
                    cafe={cafe}
                    layout="carousel"
                    localRating={ratingsByCafeId[cafe.id]}
                    recommendationReason={null}
                    isSaved={isSaved(cafe.id)}
                    distanceLabel={cafe.distanceLabel ?? null}
                    onSavePress={() => void toggleSaved(cafe.id)}
                    onPress={() => router.push(`/cafe/${cafe.id}`)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          {noticeBoardRows.length > 0 ? (
            <View style={styles.homeSection}>
              <View style={styles.homeSectionHeader}>
                <Text style={styles.secondarySectionTitle}>Beaned Bulletin</Text>
                <Text style={styles.secondarySectionSubtitle}>Recent notes from the community</Text>
              </View>
              <View style={styles.noticeBoardList}>
                {noticeBoardRows.map((row) => {
                  const cafeTarget = row.cafeId ?? row.cafeSlug;
                  return (
                    <Pressable
                      key={`${row.cafeId ?? 'pending'}-${row.createdAt}`}
                      accessibilityRole={cafeTarget ? 'button' : undefined}
                      accessibilityLabel={cafeTarget ? `Open ${row.cafeName}` : row.cafeName}
                      onPress={cafeTarget ? () => router.push(`/cafe/${cafeTarget}`) : undefined}
                      disabled={!cafeTarget}
                      style={({ pressed }) => [styles.noticeCard, pressed && styles.noticeCardPressed]}
                    >
                      <Image
                        source={{ uri: row.thumbnailUrl }}
                        style={styles.noticeThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.noticeContent}>
                        <Text style={styles.noticeQuote} numberOfLines={4}>
                          {'\u201C'}
                          {row.note}
                          {'\u201D'}
                        </Text>
                        <Text style={styles.noticeCafeMeta} numberOfLines={1}>
                          {row.cafeName}
                          {row.cafeArea ? ` \u00B7 ${row.cafeArea}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
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
    gap: 18,
  },
  onboardingBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  onboardingBannerTextWrap: {
    flex: 1,
    gap: 2,
  },
  onboardingBannerTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  onboardingBannerBody: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  onboardingBannerDismiss: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  homeSection: {
    gap: 9,
  },
  homeSectionHeader: {
    gap: 6,
    marginBottom: 0,
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
  secondarySectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.45,
  },
  secondarySectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.1,
  },
  picksRow: {
    marginHorizontal: -SCREEN_HORIZONTAL_PADDING,
    marginTop: 0,
  },
  picksRowContent: {
    paddingLeft: 16,
    paddingRight: 16,
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
  heroTextBlock: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 2,
    gap: 4,
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
    fontFamily: FONTS.sans.regular,
    color: 'rgba(250,248,245,0.88)',
    letterSpacing: -0.05,
  },
  heroLocationScore: {
    fontFamily: FONTS.sans.medium,
    color: 'rgba(250,248,245,0.96)',
  },
  heroLocationDot: {
    color: 'rgba(250,248,245,0.7)',
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
  featuredBodyNoTags: {
    gap: 8,
  },
  tagsWithIcons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.tagBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    letterSpacing: -0.1,
  },
  featuredSummary: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
  },
  insightLineWrap: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.coffeePillBorder,
    backgroundColor: COLORS.coffeePillBackground,
  },
  insightLine: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.sans.regular,
    fontStyle: 'italic',
    color: COLORS.accent,
    opacity: 0.92,
  },
  noticeBoardList: {
    gap: 10,
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...SHADOWS.none,
  },
  noticeThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: COLORS.imagePlaceholder,
  },
  noticeContent: {
    flex: 1,
    gap: 7,
  },
  noticeCardPressed: {
    opacity: 0.92,
  },
  noticeQuote: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
  },
  noticeCafeMeta: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.semibold,
    letterSpacing: -0.05,
  },
});
