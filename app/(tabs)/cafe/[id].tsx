import { CafeImage } from '@/components/CafeImage';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { COLORS, FONTS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { withCafeDistances } from '@/lib/cafeDistance';
import {
  hasValidCafeCoordinates,
  resolveCafeGoogleMapsWebUrl,
  resolveCafeMapsUrl,
} from '@/lib/cafeMapsUrl';
import { buildCafeShareMessage } from '@/lib/cafeShareMessage';
import { formatTagLabel } from '@/lib/cafeTags';
import { getApprovedCafePhotoUrls } from '@/lib/cafePhotoSubmissions';
import { CAFE_PLACEHOLDER_IMAGE_URL, resolveLiveCafeImageUrls } from '@/lib/cafeLiveImages';
import { formatCoffeeRatingValue } from '@/lib/coffeeRating';
import { formatPublicCoffeeForCafe } from '@/lib/publicCoffeeDisplay';
import {
  getCafeCommunityTagInsight,
  getRecentCafeReviews,
  resolveCafeDisplayTags,
  type CafeCommunityTagInsight,
  type CafeRecentReview,
} from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getMostRecentUserVisitForCafe } from '@/lib/userCafeVisits';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { type Cafe } from '@/data/cafes';

const FEATURE_TAG_COUNT = 6;

function heroGradientId(cafeId: string): string {
  return `detailHero_${cafeId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

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

function ImageHeroBottomFade({ cafeId, width, height }: { cafeId: string; width: number; height: number }) {
  const gid = `${heroGradientId(cafeId)}_bot`;
  if (width <= 0 || height <= 0) return null;
  return (
    <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0a0a0a" stopOpacity="0" />
          <Stop offset="0.45" stopColor="#0a0a0a" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#0a0a0a" stopOpacity="0.72" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gid})`} />
    </Svg>
  );
}

function formatIdentityAddress(cafe: Cafe): string {
  const line = (cafe.addressLine ?? '').trim();
  if (line.length > 0) return line;
  return `${cafe.neighborhood}\nOpen in Google Maps for the exact pin`;
}

function ActionButton({
  label,
  accentActive = false,
  onPress,
}: {
  label: string;
  accentActive?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.actionButton, accentActive && styles.actionButtonAccent]}
      onPress={onPress}
    >
      <Text style={[styles.actionButtonText, accentActive && styles.actionButtonTextAccent]}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatReviewDate(dateIso: string | null): string | null {
  if (!dateIso) return null;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CafeDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { toggleSaved, isSaved } = useCafeState();
  const { requireAuth } = useRequireAuth();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [cafeLoading, setCafeLoading] = useState(true);
  const [heroGSize, setHeroGSize] = useState({ w: 0, h: 0 });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [featureTags, setFeatureTags] = useState<string[]>([]);
  const [tagInsight, setTagInsight] = useState<CafeCommunityTagInsight | null>(null);
  const [recentReviews, setRecentReviews] = useState<CafeRecentReview[]>([]);
  const [approvedUserPhotoUrls, setApprovedUserPhotoUrls] = useState<string[]>([]);
  const [mostRecentVisitId, setMostRecentVisitId] = useState<string | null>(null);
  const { coords: userLocation, refreshLocation } = useUserLocation();

  const { width: windowWidth } = useWindowDimensions();
  const photoUrls = useMemo(() => {
    if (!cafe) return [];
    return resolveLiveCafeImageUrls({
      cafe,
      approvedPhotoUrls: approvedUserPhotoUrls,
    });
  }, [cafe, approvedUserPhotoUrls]);
  const heroPageW = heroGSize.w > 0 ? heroGSize.w : windowWidth;
  const heroPageH = heroGSize.h > 0 ? heroGSize.h : heroPageW / (3 / 2);
  const heroDisplayWidth = Math.min(960, Math.round(heroPageW * 1.5));
  const heroDisplayHeight = Math.min(640, Math.round(heroPageH * 1.5));

  useEffect(() => {
    // Refresh location on detail mount so the decision screen uses current distance when available.
    void refreshLocation();
  }, [refreshLocation]);

  const loadCafeDetail = useCallback(async (showLoading: boolean) => {
    if (!cafeId) {
      setCafe(null);
      setCafeLoading(false);
      setMostRecentVisitId(null);
      return;
    }
    if (showLoading) setCafeLoading(true);
    const row = await fetchCafeByIdFromSupabase(String(cafeId));
    setCafe(row);
    setCafeLoading(false);
  }, [cafeId]);

  useEffect(() => {
    void loadCafeDetail(true);
  }, [loadCafeDetail]);

  useFocusEffect(
    useCallback(() => {
      void loadCafeDetail(false);
    }, [loadCafeDetail])
  );

  useEffect(() => {
    let cancelled = false;
    if (!cafe?.id) {
      setMostRecentVisitId(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const recent = await getMostRecentUserVisitForCafe(cafe.id);
      if (cancelled) return;
      setMostRecentVisitId(recent?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe?.id]);

  useEffect(() => {
    if (!cafe?.id) {
      setFeatureTags([]);
      setTagInsight(null);
      setRecentReviews([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const c = cafe;
      if (!c) return;
      const [popular, insight, reviews] = await Promise.all([
        resolveCafeDisplayTags(c, FEATURE_TAG_COUNT),
        getCafeCommunityTagInsight(c.id),
        getRecentCafeReviews(c.id, 3),
      ]);
      if (cancelled) return;
      setFeatureTags(popular);
      setTagInsight(insight);
      setRecentReviews(reviews);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe?.id, cafe?.tags]);

  useEffect(() => {
    if (!cafe?.id) {
      setApprovedUserPhotoUrls([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const approvedUrls = await getApprovedCafePhotoUrls(cafe.id);
      if (cancelled) return;
      setApprovedUserPhotoUrls(approvedUrls);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe?.id]);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [cafe?.id, photoUrls.length]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Deep-linked web entry has no history; return to Home tab without clobbering the URL stack awkwardly.
    router.replace('/(tabs)');
  }, [navigation, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const routeCafeId = cafeId ? String(cafeId) : '';
  const cafeWithDistance = useMemo(() => {
    if (!cafe) return null;
    return withCafeDistances([cafe], userLocation)[0] ?? cafe;
  }, [cafe, userLocation]);
  const detailDistanceMiles = cafeWithDistance?.distanceMiles ?? null;
  const detailDistanceLabel = cafeWithDistance?.distanceLabel ?? null;
  const detailScoreLabel = cafeWithDistance
    ? formatPublicCoffeeForCafe(cafeWithDistance)
    : formatPublicCoffeeForCafe({ publicCoffeeScore: null, coffeeRatingCount: 0 });
  const detailNeighborhood = (cafeWithDistance?.neighborhood ?? '').trim();
  const detailDistanceText = detailDistanceLabel ? `${detailDistanceLabel} away` : null;

  const heroBackRow = (
    <View style={styles.heroBackRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.heroBackHit}
      >
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  if (cafeLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {heroBackRow}
        <View style={styles.notFoundWrap}>
          <ActivityIndicator size="large" color={COLORS.muted} />
        </View>
      </SafeAreaView>
    );
  }

  if (!cafe) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {heroBackRow}
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundTitle}>Cafe not found</Text>
          <Text style={styles.notFoundText}>We could not find a cafe for this id.</Text>
        </View>
      </SafeAreaView>
    );
  }

  async function handleOpenGoogleMaps() {
    if (!cafe) return;
    const url = resolveCafeMapsUrl(cafe);
    if (!url) {
      Alert.alert('Map link unavailable', 'No location could be determined for this cafe.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open link', 'This maps link could not be opened on your device.');
    }
  }

  function handleShowOnBeanedMap() {
    if (!cafe) return;
    if (!hasValidCafeCoordinates(cafe)) return;

    // Route to the Search screen, which hosts the in-app map.
    void router.push({
      pathname: '/search',
      params: {
        cafe_id: cafe.id,
        latitude: String(cafe.latitude),
        longitude: String(cafe.longitude),
      },
    });
  }

  function handleShowOnGoogleMapsWeb() {
    if (!cafe) return;
    const url = resolveCafeGoogleMapsWebUrl(cafe);
    if (!url) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    void Linking.openURL(url);
  }

  async function handleSavePress() {
    if (!cafe) return;
    if (__DEV__) {
      console.log('[Save cafe] press', {
        cafeId: cafe.id,
        routeCafeId,
        currentlySaved: isSaved(cafe.id),
        willCall: 'toggleSaved',
      });
    }
    await toggleSaved(cafe.id);
    if (__DEV__) {
      console.log('[Save cafe] toggleSaved finished', { cafeId: cafe.id });
    }
  }

  const onShare = async () => {
    try {
      await Share.share({
        message: buildCafeShareMessage(cafe),
        title: cafe.name,
      });
    } catch {
      /* dismissed */
    }
  };

  const webGoogleMapsUrl = Platform.OS === 'web' ? resolveCafeGoogleMapsWebUrl(cafe) : null;

  const insightBubbleText = (() => {
    if (tagInsight) {
      const tagForSentence = formatTagLabel(tagInsight.tag ?? '').toLowerCase();
      return `${tagInsight.percent}% of people rate this for ${tagForSentence}`;
    }
    if (cafe.coffeeRatingCount > 0) {
      return `Based on ${cafe.coffeeRatingCount} community coffee score${cafe.coffeeRatingCount === 1 ? '' : 's'} — tag picks will show here as more people rate.`;
    }
    return 'Community picks will appear here once more people rate and tag this cafe.';
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View
          style={styles.heroWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setHeroGSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
          }}
        >
          {photoUrls.length === 0 ? (
            <CafeImage
              uri={CAFE_PLACEHOLDER_IMAGE_URL}
              style={styles.heroImage}
              displayWidth={heroDisplayWidth}
              displayHeight={heroDisplayHeight}
              lazy={false}
              priority="high"
            />
          ) : photoUrls.length === 1 ? (
            <CafeImage
              uri={photoUrls[0]}
              style={styles.heroImage}
              displayWidth={heroDisplayWidth}
              displayHeight={heroDisplayHeight}
              lazy={false}
              priority="high"
            />
          ) : (
            <FlatList
              data={photoUrls}
              keyExtractor={(uri, index) => `${cafe.id}-gallery-${index}-${uri}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              decelerationRate="fast"
              snapToInterval={heroPageW}
              snapToAlignment="start"
              disableIntervalMomentum
              style={styles.heroImagePager}
              nestedScrollEnabled
              removeClippedSubviews
              getItemLayout={(_, index) => ({
                length: heroPageW,
                offset: heroPageW * index,
                index,
              })}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const nextIndex = Math.round(offsetX / heroPageW);
                const boundedIndex = Math.max(0, Math.min(photoUrls.length - 1, nextIndex));
                setCurrentPhotoIndex((prev) => (prev === boundedIndex ? prev : boundedIndex));
              }}
              renderItem={({ item: uri, index }) => (
                <CafeImage
                  uri={uri}
                  style={{ width: heroPageW, height: heroPageH }}
                  displayWidth={heroDisplayWidth}
                  displayHeight={heroDisplayHeight}
                  lazy={index > 0}
                  priority={index === 0 ? 'high' : 'low'}
                />
              )}
            >
            </FlatList>
          )}

          {photoUrls.length > 1 ? (
            <View pointerEvents="none" style={styles.heroPagerDotsWrap}>
              {photoUrls.map((_, index) => (
                <View
                  key={`${cafe.id}-dot-${index}`}
                  style={[styles.heroPagerDot, index === currentPhotoIndex && styles.heroPagerDotActive]}
                />
              ))}
            </View>
          ) : null}

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

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.heroBackFab}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.95)" />
          </TouchableOpacity>

          <View style={styles.heroTopRight}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open directions"
              onPress={() => void handleOpenGoogleMaps()}
              style={({ pressed }) => [styles.heroIconFab, pressed && styles.heroIconFabPressed]}
            >
              <Ionicons name="navigate-outline" size={20} color="rgba(34,30,26,0.92)" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSaved(cafe.id) ? 'Saved' : 'Save cafe'}
              onPress={() => void handleSavePress()}
              style={({ pressed }) => [styles.heroIconFab, pressed && styles.heroIconFabPressed]}
            >
              <Ionicons
                name={isSaved(cafe.id) ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color="rgba(34,30,26,0.92)"
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share this cafe"
              onPress={() => void onShare()}
              style={({ pressed }) => [styles.heroIconFab, pressed && styles.heroIconFabPressed]}
            >
              <Ionicons name="share-outline" size={20} color="rgba(34,30,26,0.92)" />
            </Pressable>
          </View>
        </View>

        <View style={styles.mainPad}>
          <View style={styles.identityTextBlock}>
            <Text style={styles.identityName}>{cafe.name}</Text>
            <Text style={styles.identityMeta} numberOfLines={1}>
              <Text style={styles.identityMetaScore}>{detailScoreLabel}</Text>
              {detailNeighborhood ? (
                <>
                  <Text style={styles.identityMetaDot}> {'\u00b7'} </Text>
                  <Text>{detailNeighborhood}</Text>
                </>
              ) : null}
              {detailDistanceMiles != null && detailDistanceText ? (
                <>
                  <Text style={styles.identityMetaDot}> {'\u2022'} </Text>
                  <Text style={styles.identityMetaDistance}>{detailDistanceText}</Text>
                </>
              ) : null}
            </Text>
            <Text style={styles.identityAddress}>{formatIdentityAddress(cafe)}</Text>

              <View style={styles.identityActionsRow}>
                {Platform.OS === 'web' ? (
                  webGoogleMapsUrl ? (
                    <CompactActionButton
                      label="Show on Google Maps"
                      onPress={handleShowOnGoogleMapsWeb}
                    />
                  ) : null
                ) : hasValidCafeCoordinates(cafe) ? (
                  <CompactActionButton label="Show on Beaned map" onPress={handleShowOnBeanedMap} />
                ) : null}
              </View>
          </View>

          {cafe.short_description ? <View style={styles.identitySummaryDivider} /> : null}

          {cafe.short_description ? (
            <>
              <Text style={styles.sectionHeading}>About</Text>
              <Text style={styles.summaryText} numberOfLines={8}>
                {cafe.short_description}
              </Text>
            </>
          ) : null}

          {featureTags.length > 0 ? (
            <>
              <Text style={styles.sectionHeading}>Features</Text>
            <View style={styles.featuresGrid}>
              {featureTags.map((tag) => (
                <View key={tag} style={styles.featureTag}>
                  <TagWithOptionalIcon
                    tag={tag}
                    iconSize={16}
                    color={COLORS.roastedBrown}
                    textStyle={styles.featureTagLabel}
                    gap={6}
                  />
                </View>
              ))}
            </View>
            </>
          ) : null}

          <View style={styles.insightBubble}>
            <Text style={styles.insightBubbleText}>{insightBubbleText}</Text>
          </View>

          {recentReviews.length > 0 ? (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionHeading}>Community notes</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reviewsRow}
              >
                {recentReviews.map((review, index) => {
                  const reviewDate = formatReviewDate(review.createdAt);
                  const ratingText =
                    typeof review.rating === 'number' && Number.isFinite(review.rating)
                      ? `${formatCoffeeRatingValue(review.rating)} ★`
                      : null;
                  const tagsText = review.tags.length > 0 ? review.tags.map((tag) => formatTagLabel(tag)).join(' · ') : null;
                  const metaLine = [ratingText, tagsText].filter((part): part is string => Boolean(part)).join(' · ');
                  return (
                    <View
                      key={`${review.createdAt ?? 'no-date'}-${index}`}
                      style={styles.reviewCard}
                    >
                      <Text style={styles.reviewText} numberOfLines={5}>
                        {'\u201C'}
                        {review.note}
                        {'\u201D'}
                      </Text>
                      {metaLine.length > 0 ? (
                        <Text style={styles.reviewMeta} numberOfLines={1}>
                          {metaLine}
                        </Text>
                      ) : null}
                      {reviewDate ? <Text style={styles.reviewDate}>{reviewDate}</Text> : null}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.actionsWrap}>
            {isSaved(cafe.id) ? (
              <Text style={styles.savedVisitPromptText}>Been here? Log your visit</Text>
            ) : null}
            <ActionButton
              label={mostRecentVisitId ? 'Edit rating' : 'Log this cafe'}
              accentActive
              onPress={() => {
                const logPath = mostRecentVisitId
                  ? `/log-visit/${cafe.id}?visitId=${encodeURIComponent(mostRecentVisitId)}`
                  : `/log-visit/${cafe.id}`;
                if (!requireAuth(logPath)) return;
                router.push(
                  mostRecentVisitId
                    ? ({
                        pathname: `/log-visit/${cafe.id}`,
                        params: { visitId: mostRecentVisitId },
                      } as never)
                    : (`/log-visit/${cafe.id}` as never)
                );
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CompactActionButton({
  label,
  accentActive = false,
  onPress,
}: {
  label: string;
  accentActive?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.compactActionButton, accentActive && styles.compactActionButtonAccent]}
      onPress={onPress}
    >
      <Text style={[styles.compactActionButtonText, accentActive && styles.compactActionButtonTextAccent]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 40,
  },
  heroWrap: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.imagePlaceholder,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroImagePager: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  heroImageFallback: {
    backgroundColor: COLORS.imagePlaceholder,
  },
  heroGradientSlot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroPagerDotsWrap: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  heroPagerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  heroPagerDotActive: {
    backgroundColor: COLORS.accent,
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
  heroBackFab: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 4,
    flexDirection: 'column',
    gap: 8,
  },
  heroIconFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(95,88,80,0.16)',
  },
  heroIconFabPressed: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    transform: [{ scale: 0.95 }],
  },
  mainPad: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  identityTextBlock: {
    gap: 6,
  },
  identityName: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  identityMeta: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.1,
  },
  identityMetaScore: {
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
  },
  identityMetaDot: {
    color: COLORS.muted,
  },
  identityMetaDistance: {
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
    opacity: 0.86,
  },
  identityAddress: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    color: 'rgba(103,94,83,0.82)',
    letterSpacing: -0.1,
  },
  identityActionsRow: {
    marginTop: 10,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  compactActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactActionButtonAccent: {
    backgroundColor: COLORS.accentSubtleFill,
    borderColor: COLORS.accentSubtleBorder,
  },
  compactActionButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  compactActionButtonTextAccent: {
    color: COLORS.accent,
  },
  identitySummaryDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginTop: 6,
    marginBottom: 10,
  },
  summaryText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  featuresEmpty: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.05,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureTag: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  featureTagLabel: {
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  insightBubble: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.coffeePillBorder,
    backgroundColor: COLORS.coffeePillBackground,
  },
  insightBubbleText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONTS.sans.regular,
    fontStyle: 'italic',
    color: COLORS.accent,
    letterSpacing: -0.05,
    opacity: 0.92,
  },
  reviewsSection: {
    gap: 10,
  },
  reviewsRow: {
    gap: 10,
    paddingRight: 6,
  },
  reviewCard: {
    width: 260,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    backgroundColor: 'rgba(248, 243, 235, 0.96)',
    paddingTop: 7,
    paddingBottom: 8,
    paddingHorizontal: 11,
    gap: 3,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 17,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
    letterSpacing: -0.05,
  },
  reviewMeta: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    opacity: 0.92,
  },
  reviewDate: {
    marginTop: -1,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONTS.sans.regular,
    color: COLORS.accent,
    opacity: 0.92,
  },
  heroBackRow: {
    alignSelf: 'stretch',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  heroBackHit: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  notFoundTitle: {
    fontSize: 24,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  notFoundText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
    fontFamily: FONTS.sans.regular,
  },
  actionsWrap: {
    marginTop: 8,
    gap: 10,
  },
  savedVisitPromptText: {
    fontSize: 13,
    color: COLORS.muted,
    fontFamily: FONTS.sans.medium,
    marginBottom: -2,
  },
  actionButton: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionButtonAccent: {
    backgroundColor: COLORS.accentSubtleFill,
    borderColor: COLORS.accentSubtleBorder,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  actionButtonTextAccent: {
    color: COLORS.accent,
  },
});
