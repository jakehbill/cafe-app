import { CafeImage } from '@/components/CafeImage';
import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import { EditorialTag } from '@/components/EditorialTag';
import { VenueTypeBadge } from '@/components/VenueTypeBadge';
import { BeanedPickBadge } from '@/components/BeanedPickBadge';
import { WorkScoreMetaRow } from '@/components/WorkScoreMetaRow';
import { COLORS, FONTS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { withCafeDistances } from '@/lib/cafeDistance';
import {
  hasValidCafeCoordinates,
  openExternalMapsUrl,
  resolveCafeMapsUrl,
} from '@/lib/cafeMapsUrl';
import { buildCafeShareMessage } from '@/lib/cafeShareMessage';
import { formatTagLabel } from '@/lib/cafeTags';
import { getApprovedCafePhotoUrls } from '@/lib/cafePhotoSubmissions';
import { CAFE_PLACEHOLDER_IMAGE_URL, resolveLiveCafeImageUrls } from '@/lib/cafeLiveImages';
import { formatCoffeeRatingValue } from '@/lib/coffeeRating';
import { getRecentCafeReviews, type CafeRecentReview } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { resolveCafeDetailBackPath } from '@/lib/authGate';
import { getMostRecentUserVisitForCafe } from '@/lib/userCafeVisits';
import { buildWorkspaceDetailFacts } from '@/lib/cafeWorkspaceSummary';
import { cafeHasPublicWorkScore } from '@/lib/publicCoffeeDisplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { type Cafe } from '@/data/cafes';
import {
  CAFE_DETAIL_ALSO_GOOD_FOR_MAX,
  CAFE_FEATURED_TAG_COUNT,
  resolveCafeTagDisplaySets,
} from '@/lib/cafeFeaturedTags';

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
  const neighborhood = (cafe.neighborhood ?? '').trim();
  if (neighborhood.length > 0) return neighborhood;
  return 'Open in Google Maps for the exact pin';
}

/** Street-first line — avoid repeating neighbourhood / city on detail. */
function shortStreetAddress(cafe: Cafe): string {
  const line = (cafe.addressLine ?? '').trim();
  if (line.length > 0) {
    const first = line.split(',')[0]?.trim() ?? '';
    if (first.length > 0) return first;
  }
  return (cafe.neighborhood ?? '').trim();
}

function identityAddressPrimaryLabel(cafe: Cafe): string {
  const street = shortStreetAddress(cafe);
  if (street.length > 0) return street;
  return (cafe.neighborhood ?? '').trim();
}

/** Drop generic coffee/food tags when quality chips already cover them. */
function filterTagsOverlappingQuality(
  tags: string[],
  quality: { coffee: boolean; food: boolean }
): string[] {
  return tags.filter((tag) => {
    const key = String(tag).trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (quality.coffee && (key === 'good_coffee' || key === 'goodcoffee')) return false;
    if (quality.food && (key === 'good_food' || key === 'goodfood' || key === 'food_available')) {
      return false;
    }
    return true;
  });
}

/** Prefer work-decision tags first (wifi, light, outlets…) then the rest. */
const WORKSPACE_HIGHLIGHT_ORDER = [
  'good_wifi',
  'good_natural_light',
  'has_outlets',
  'quiet',
  'good_for_calls',
  'comfortable_seating',
  'spacious',
  'long_stays_welcome',
  'air_conditioning',
  'open_late',
  'friendly_staff',
  'work_friendly',
  'good_coffee',
  'good_food',
] as const;

function normalizeHighlightKey(tag: string): string {
  return String(tag).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function sortWorkspaceHighlights(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const ka = normalizeHighlightKey(a);
    const kb = normalizeHighlightKey(b);
    const ia = WORKSPACE_HIGHLIGHT_ORDER.indexOf(ka as (typeof WORKSPACE_HIGHLIGHT_ORDER)[number]);
    const ib = WORKSPACE_HIGHLIGHT_ORDER.indexOf(kb as (typeof WORKSPACE_HIGHLIGHT_ORDER)[number]);
    const ra = ia === -1 ? 900 : ia;
    const rb = ib === -1 ? 900 : ib;
    if (ra !== rb) return ra - rb;
    return formatTagLabel(a).localeCompare(formatTagLabel(b));
  });
}

function reviewStarsLabel(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating / 2)));
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
}

function formatReviewTagLine(tags: string[]): string | null {
  const labels = tags
    .map((tag) => formatTagLabel(tag).trim())
    .filter(Boolean)
    .map((label) =>
      label
        .replace(/^Good\s+/i, '')
        .replace(/\bWiFi\b/gi, 'Wi-Fi')
        .replace(/\bWifi\b/g, 'Wi-Fi')
    );
  if (labels.length === 0) return null;
  return labels.slice(0, 3).join(' · ');
}

function CafeIdentityAddress({
  cafe,
  distanceText,
  onOpenMaps,
}: {
  cafe: Cafe;
  distanceText?: string | null;
  onOpenMaps: () => void;
}) {
  const mapsUrl = resolveCafeMapsUrl(cafe);
  const street = identityAddressPrimaryLabel(cafe);
  const distance = String(distanceText ?? '').trim();

  if (!mapsUrl) {
    const fallback = street || formatIdentityAddress(cafe);
    if (!fallback && !distance) return null;
    return (
      <View style={styles.identityAddressBlock}>
        {fallback ? (
          <Text style={styles.identityAddressMuted} numberOfLines={1}>
            {'\u{1F4CD} '}
            {fallback}
          </Text>
        ) : null}
        {distance ? <Text style={styles.identityAddressDistanceMuted}>{distance}</Text> : null}
      </View>
    );
  }

  const label = street.length > 0 ? street : 'View on Google Maps';

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open directions for ${label}`}
      onPress={onOpenMaps}
      style={({ pressed, hovered }) => [
        styles.identityAddressBlock,
        pressed && styles.identityAddressPressed,
        Platform.OS === 'web' && hovered && styles.identityAddressHovered,
      ]}
    >
      <Text style={styles.identityAddressMuted} numberOfLines={1}>
        {'\u{1F4CD} '}
        {label}
      </Text>
      <Text style={styles.identityAddressDistanceMuted} numberOfLines={1}>
        {distance ? `${distance} ` : ''}
        {'\u2197'}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  accentActive = false,
  variant = 'primary',
  onPress,
}: {
  label: string;
  accentActive?: boolean;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
}) {
  const secondary = variant === 'secondary';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.actionButton,
        accentActive && !secondary && styles.actionButtonAccent,
        secondary && styles.actionButtonSecondary,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionButtonText,
          accentActive && !secondary && styles.actionButtonTextAccent,
          secondary && styles.actionButtonTextSecondary,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function WorkspaceSnapshotRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.snapshotRow, !isLast && styles.snapshotRowBorder]}>
      <Text style={styles.snapshotIcon}>{icon}</Text>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <View style={styles.snapshotLeader} />
      <Text style={styles.snapshotValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
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
  const { id, returnTo, source } = useLocalSearchParams<{
    id?: string | string[];
    returnTo?: string | string[];
    source?: string | string[];
  }>();
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
  const [remainingTags, setRemainingTags] = useState<string[]>([]);
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

  const heroPhotoViewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onHeroPhotoViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const primary = viewableItems.find((item) => item.isViewable);
      const idx = primary?.index;
      if (typeof idx === 'number' && idx >= 0) {
        setCurrentPhotoIndex((prev) => (prev === idx ? prev : idx));
      }
    }
  ).current;

  const syncPhotoIndexFromScroll = useCallback(
    (offsetX: number) => {
      if (heroPageW <= 0 || photoUrls.length <= 1) return;
      const nextIndex = Math.round(offsetX / heroPageW);
      const boundedIndex = Math.max(0, Math.min(photoUrls.length - 1, nextIndex));
      setCurrentPhotoIndex((prev) => (prev === boundedIndex ? prev : boundedIndex));
    },
    [heroPageW, photoUrls.length]
  );

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
      setRemainingTags([]);
      setRecentReviews([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const c = cafe;
      if (!c) return;
      const [tagSets, reviews] = await Promise.all([
        resolveCafeTagDisplaySets(c, CAFE_FEATURED_TAG_COUNT),
        getRecentCafeReviews(c.id, 3),
      ]);
      if (cancelled) return;
      setFeatureTags(tagSets.featured);
      setRemainingTags(tagSets.remaining.slice(0, CAFE_DETAIL_ALSO_GOOD_FOR_MAX));
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

  const detailBackPath = resolveCafeDetailBackPath({ returnTo, source });

  const handleBack = useCallback(() => {
    if (detailBackPath) {
      router.replace(detailBackPath as never);
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Deep-linked web entry has no history; return to Home tab without clobbering the URL stack awkwardly.
    router.replace('/(tabs)');
  }, [detailBackPath, navigation, router]);

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
  const detailDistanceLabel = cafeWithDistance?.distanceLabel ?? null;
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
          <Text style={styles.notFoundText}>We could not find a space for this id.</Text>
        </View>
      </SafeAreaView>
    );
  }

  async function handleOpenGoogleMaps() {
    if (!cafe) return;
    const url = resolveCafeMapsUrl(cafe);
    if (!url) {
      Alert.alert('Map link unavailable', 'No location could be determined for this space.');
      return;
    }
    try {
      await openExternalMapsUrl(url);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <DesktopWebPageContainer variant="detail" style={styles.pageContainer}>
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
              removeClippedSubviews={Platform.OS !== 'web'}
              scrollEventThrottle={16}
              viewabilityConfig={heroPhotoViewabilityConfig}
              onViewableItemsChanged={onHeroPhotoViewableItemsChanged}
              getItemLayout={(_, index) => ({
                length: heroPageW,
                offset: heroPageW * index,
                index,
              })}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                syncPhotoIndexFromScroll(e.nativeEvent.contentOffset.x);
              }}
              onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                syncPhotoIndexFromScroll(e.nativeEvent.contentOffset.x);
              }}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                syncPhotoIndexFromScroll(e.nativeEvent.contentOffset.x);
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
            />
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
              accessibilityLabel={isSaved(cafe.id) ? 'Saved' : 'Save space'}
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
              accessibilityLabel="Share this space"
              onPress={() => void onShare()}
              style={({ pressed }) => [styles.heroIconFab, pressed && styles.heroIconFabPressed]}
            >
              <Ionicons name="share-outline" size={20} color="rgba(34,30,26,0.92)" />
            </Pressable>
          </View>
        </View>

        <View style={styles.mainPad}>
          <View style={styles.identityTextBlock}>
            <VenueTypeBadge venueType={cafe.venueType} style={styles.identityVenueBadge} />
            <Text style={styles.identityName}>{cafe.name}</Text>
            <View style={styles.identityMetaLine}>
              <View style={styles.identityScoreCol}>
                <WorkScoreMetaRow cafe={cafe} size="detail" style={styles.identityMetaRow} />
                {cafeHasPublicWorkScore(cafe) && cafe.coffeeRatingCount > 0 ? (
                  <Text style={styles.basedOnReviews}>
                    Based on {cafe.coffeeRatingCount}{' '}
                    {cafe.coffeeRatingCount === 1 ? 'review' : 'reviews'}
                  </Text>
                ) : null}
              </View>
              {cafe.isCertified ? (
                <BeanedPickBadge
                  size="inline"
                  subtitle="One of our favourite workspaces."
                />
              ) : null}
            </View>
            <CafeIdentityAddress
              cafe={cafe}
              distanceText={detailDistanceText}
              onOpenMaps={() => void handleOpenGoogleMaps()}
            />
            {(() => {
              const facts = buildWorkspaceDetailFacts(cafe);
              const rows: { icon: string; label: string; value: string }[] = [];
              if (facts.wifi) rows.push({ icon: '📶', label: 'Wi-Fi', value: facts.wifi });
              if (facts.seatFinding) {
                rows.push({ icon: '💺', label: 'Seating', value: facts.seatFinding });
              }
              if (facts.workSession) {
                rows.push({ icon: '🕒', label: 'Typical visit', value: facts.workSession });
              }
              if (facts.costToWork) {
                rows.push({ icon: '💷', label: 'Typical spend', value: facts.costToWork });
              }
              if (rows.length === 0) return null;
              return (
                <View style={styles.snapshotBlock}>
                  <Text style={styles.sectionHeading}>Workspace Snapshot</Text>
                  <View style={styles.snapshotCard}>
                    {rows.map((row, index) => (
                      <WorkspaceSnapshotRow
                        key={row.label}
                        icon={row.icon}
                        label={row.label}
                        value={row.value}
                        isLast={index === rows.length - 1}
                      />
                    ))}
                  </View>
                </View>
              );
            })()}

            {Platform.OS !== 'web' && hasValidCafeCoordinates(cafe) ? (
              <View style={styles.identityActionsRow}>
                <CompactActionButton label="Show on Beaned map" onPress={handleShowOnBeanedMap} />
              </View>
            ) : null}
          </View>

          {(() => {
            const facts = buildWorkspaceDetailFacts(cafe);
            const qualityCoffee = Boolean(facts.coffee);
            const qualityFood = Boolean(facts.food);
            const filteredTags = sortWorkspaceHighlights(
              filterTagsOverlappingQuality(featureTags, {
                coffee: qualityCoffee,
                food: qualityFood,
              })
            );
            const hasTags = filteredTags.length > 0 || qualityCoffee || qualityFood;
            if (!hasTags) return null;
            return (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>Highlights</Text>
                <View style={styles.featuresGrid}>
                  {filteredTags.map((tag) => (
                    <EditorialTag key={tag} tag={tag} variant="featured" />
                  ))}
                  {qualityCoffee ? (
                    <View style={styles.qualityChip} accessibilityRole="text">
                      <Ionicons name="cafe-outline" size={13} color={COLORS.text} />
                      <Text style={styles.qualityChipText}>{facts.coffee} coffee</Text>
                    </View>
                  ) : null}
                  {qualityFood ? (
                    <View style={styles.qualityChip} accessibilityRole="text">
                      <Ionicons name="restaurant-outline" size={13} color={COLORS.text} />
                      <Text style={styles.qualityChipText}>{facts.food} food</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })()}

          {recentReviews.length > 0 ? (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionHeading}>What remote workers say</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reviewsRow}
              >
                {recentReviews.map((review, index) => {
                  const reviewDate = formatReviewDate(review.createdAt);
                  const hasRating =
                    typeof review.rating === 'number' && Number.isFinite(review.rating);
                  const scoreText = hasRating ? formatCoffeeRatingValue(review.rating) : null;
                  const tagsLine = formatReviewTagLine(review.tags);
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
                      {scoreText ? (
                        <Text style={styles.reviewScoreLine} numberOfLines={1}>
                          {reviewStarsLabel(review.rating!)} {scoreText}
                        </Text>
                      ) : null}
                      {tagsLine ? (
                        <Text style={styles.reviewMeta} numberOfLines={2}>
                          {tagsLine}
                        </Text>
                      ) : null}
                      {reviewDate ? <Text style={styles.reviewDate}>{reviewDate}</Text> : null}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {cafe.short_description ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>About</Text>
              <Text style={styles.summaryText} numberOfLines={8}>
                {cafe.short_description}
              </Text>
            </View>
          ) : null}

          {(() => {
            const facts = buildWorkspaceDetailFacts(cafe);
            const alsoTags = sortWorkspaceHighlights(
              filterTagsOverlappingQuality(remainingTags, {
                coffee: Boolean(facts.coffee),
                food: Boolean(facts.food),
              })
            );
            if (alsoTags.length === 0) return null;
            return (
              <View style={styles.alsoGoodForSection}>
                <Text style={styles.alsoGoodForHeading}>Also good for</Text>
                <View style={styles.alsoGoodForTagsRow}>
                  {alsoTags.map((tag) => (
                    <EditorialTag key={tag} tag={tag} variant="secondary" />
                  ))}
                </View>
              </View>
            );
          })()}

          <View style={styles.actionsWrap}>
            {isSaved(cafe.id) && !mostRecentVisitId ? (
              <Text style={styles.savedVisitPromptText}>Worked here? Log this space</Text>
            ) : null}
            <ActionButton
              label={
                mostRecentVisitId
                  ? 'Edit rating'
                  : cafeHasPublicWorkScore(cafe)
                    ? 'Log this space'
                    : 'Be the first to review'
              }
              accentActive={!mostRecentVisitId}
              variant={mostRecentVisitId ? 'secondary' : 'primary'}
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
      </DesktopWebPageContainer>
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
  pageContainer: {
    flex: 1,
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
    paddingTop: 18,
    gap: 18,
  },
  identityTextBlock: {
    gap: 8,
  },
  identityName: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  identityVenueBadge: {
    marginTop: 0,
    marginBottom: 0,
  },
  identityMetaLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  identityScoreCol: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  identityMetaRow: {
    flexShrink: 1,
  },
  basedOnReviews: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.05,
  },
  snapshotBlock: {
    marginTop: 6,
    gap: 8,
  },
  snapshotCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 10,
  },
  snapshotRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  snapshotIcon: {
    fontSize: 13,
    lineHeight: 18,
    width: 20,
  },
  snapshotLabel: {
    flexShrink: 0,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.1,
  },
  snapshotLeader: {
    flex: 1,
    minWidth: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dotted',
    borderColor: 'rgba(0,0,0,0.22)',
    marginHorizontal: 4,
    marginBottom: 3,
    alignSelf: 'flex-end',
  },
  snapshotValue: {
    flexShrink: 1,
    maxWidth: '48%',
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.15,
  },
  qualityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
    backgroundColor: 'transparent',
  },
  qualityChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
    letterSpacing: -0.1,
  },
  sectionBlock: {
    gap: 10,
  },
  identityAddressBlock: {
    gap: 2,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  identityAddressMuted: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: 'rgba(103,94,83,0.72)',
    letterSpacing: -0.1,
  },
  identityAddressDistanceMuted: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: 'rgba(103,94,83,0.62)',
    letterSpacing: -0.05,
    paddingLeft: 2,
  },
  identityAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    gap: 5,
    maxWidth: '100%',
  },
  identityAddressIcon: {
    marginTop: 2,
    opacity: 0.88,
  },
  identityAddressLinkText: {
    flexShrink: 1,
  },
  identityAddressLinkCue: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    opacity: 0.75,
    marginTop: 1,
  },
  identityAddressPressed: {
    opacity: 0.72,
  },
  identityAddressHovered: {
    opacity: 0.88,
  },
  identityActionsRow: {
    marginTop: 6,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  /** @deprecated kept for CompactActionButton shared styles below */
  identityAddress: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: 'rgba(103,94,83,0.72)',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  compactActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactActionButtonAccent: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  compactActionButtonText: {
    color: COLORS.buttonLabelOnAccent,
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  compactActionButtonTextAccent: {
    color: COLORS.buttonLabelOnAccent,
  },
  identitySummaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginTop: 2,
    marginBottom: 2,
  },
  summaryText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    gap: 8,
  },
  reviewsSection: {
    gap: 10,
  },
  reviewsRow: {
    gap: 10,
    paddingRight: 6,
    /** Prevent horizontal scroll children stretching to the tallest card. */
    alignItems: 'flex-start',
  },
  reviewCard: {
    width: 260,
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
    letterSpacing: -0.05,
  },
  reviewScoreLine: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.05,
  },
  reviewMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    opacity: 0.92,
  },
  reviewDate: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    opacity: 0.85,
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
  alsoGoodForSection: {
    marginTop: 2,
    gap: 4,
    paddingTop: 2,
  },
  alsoGoodForHeading: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  alsoGoodForTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
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
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  actionButtonAccent: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(0,0,0,0.22)',
    paddingVertical: 11,
  },
  actionButtonText: {
    color: COLORS.buttonLabelOnAccent,
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  actionButtonTextAccent: {
    color: COLORS.buttonLabelOnAccent,
  },
  actionButtonTextSecondary: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: FONTS.sans.medium,
  },
});
