import { useCafeState } from '@/contexts/CafeStateContext';
import { PublicCoffeeScoreText } from '@/components/PublicCoffeeScoreText';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { useCafeCatalog } from '@/hooks/useCafeCatalog';
import { formatTagLabel } from '@/lib/cafeTags';
import { buildTasteProfileFromState } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import type { Cafe } from '../../data/cafes';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';

const MAX_VISIBLE_TAGS = 3;

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

function tagLeadingIcon(tag: string): keyof typeof Ionicons.glyphMap {
  const t = tag.toLowerCase();
  if (t.includes('quiet')) return 'volume-mute-outline';
  if (t.includes('quick') || t.includes('fast')) return 'flash-outline';
  if (t.includes('specialty') || t.includes('roast')) return 'cafe-outline';
  if (t.includes('outdoor') || t.includes('patio')) return 'sunny-outline';
  return 'pricetag-outline';
}

function ActionButton({
  label,
  variant = 'primary',
  accentActive = false,
  onPress,
}: {
  label: string;
  variant?: 'primary' | 'secondary';
  accentActive?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.actionButton,
        variant === 'secondary' && styles.actionButtonSecondary,
        accentActive && styles.actionButtonAccent,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionButtonText,
          variant === 'secondary' && !accentActive && styles.actionButtonTextSecondary,
          accentActive && styles.actionButtonTextAccent,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CafeDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const navigation = useNavigation();
  const {
    toggleSaved,
    toggleVisited,
    isSaved,
    isVisited,
    getCafeRating,
    ratingsByCafeId,
    visitedCafeIds,
    savedCafeIds,
  } = useCafeState();
  const { cafes: cafeCatalog } = useCafeCatalog();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [cafeLoading, setCafeLoading] = useState(true);
  const [heroGSize, setHeroGSize] = useState({ w: 0, h: 0 });

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds),
    [ratingsByCafeId, cafeCatalog, visitedCafeIds, savedCafeIds]
  );

  const recommendationReason = useMemo(
    () => (cafe ? getRecommendationReason(cafe, tasteProfile) : null),
    [cafe, tasteProfile]
  );

  useEffect(() => {
    if (!cafeId) {
      setCafe(null);
      setCafeLoading(false);
      return;
    }
    let cancelled = false;
    setCafeLoading(true);
    void (async () => {
      const row = await fetchCafeByIdFromSupabase(String(cafeId));
      if (!cancelled) {
        setCafe(row);
        setCafeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cafeId]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/');
    }
  }, [navigation, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const routeCafeId = cafeId ? String(cafeId) : '';

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

  const localRating = getCafeRating(cafe.id);
  const ratingSource = localRating
    ? {
        coffee: localRating.coffee,
        tags: localRating.tags,
        notes: localRating.notes,
      }
    : {
        coffee: cafe.publicCoffeeScore ?? 0,
        tags: cafe.tags,
        notes: '',
      };
  const displayTags = ratingSource.tags.slice(0, MAX_VISIBLE_TAGS);
  const mapsUrl = cafe.googleMapsUrl;
  const hasGoogleMapsUrl = typeof mapsUrl === 'string' && mapsUrl.trim().length > 0;

  async function handleOpenGoogleMaps() {
    if (!hasGoogleMapsUrl) {
      Alert.alert('Map link unavailable', 'No Google Maps link is available for this cafe.');
      return;
    }

    const canOpen = await Linking.canOpenURL(mapsUrl);

    if (!canOpen) {
      Alert.alert('Cannot open link', 'This Google Maps link is not supported on your device.');
      return;
    }

    await Linking.openURL(mapsUrl);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View
          style={styles.heroWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setHeroGSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
          }}
        >
          {cafe.imageUrl ? (
            <Image source={{ uri: cafe.imageUrl }} style={styles.heroImage} resizeMode="cover" />
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

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.heroBackFab}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.95)" />
          </TouchableOpacity>

          {(isSaved(cafe.id) || localRating) && (
            <View style={styles.heroStatusPills} pointerEvents="none">
              {isSaved(cafe.id) ? (
                <View style={styles.heroMiniPill}>
                  <Text style={styles.heroMiniPillText}>Saved</Text>
                </View>
              ) : null}
              {localRating ? (
                <View style={styles.heroMiniPill}>
                  <Text style={styles.heroMiniPillText}>Rated by you</Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.heroTextBlock} pointerEvents="none">
            <Text style={styles.heroTitle} numberOfLines={2}>
              {cafe.name}
            </Text>
            <Text style={styles.heroLocation} numberOfLines={1}>
              {cafe.neighborhood}
            </Text>
          </View>
        </View>

        <View style={styles.featuredBody}>
          <View style={styles.tagsScoreRow}>
            <View style={styles.tagsWithIcons}>
              {displayTags.map((tag) => (
                <View key={tag} style={styles.tagWithIcon}>
                  <Ionicons name={tagLeadingIcon(tag)} size={16} color={COLORS.roastedBrown} />
                  <Text style={styles.tagWithIconLabel}>{formatTagLabel(tag)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.publicScoreWrap}>
              <PublicCoffeeScoreText cafe={cafe} />
            </View>
          </View>

          <Text numberOfLines={6} style={styles.featuredSummary}>
            {cafe.summary}
          </Text>

          {recommendationReason ? (
            <Text style={styles.insightLine} numberOfLines={3}>
              {recommendationReason}
            </Text>
          ) : null}

          {ratingSource.notes ? (
            <Text numberOfLines={4} style={styles.notesText}>
              {ratingSource.notes}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsWrap}>
          <ActionButton
            label={isSaved(cafe.id) ? 'Saved' : 'Save'}
            variant="secondary"
            accentActive={isSaved(cafe.id)}
            onPress={() => void handleSavePress()}
          />
          <ActionButton
            label={isVisited(cafe.id) ? 'Visited' : 'Mark Visited'}
            variant="secondary"
            accentActive={isVisited(cafe.id)}
            onPress={() => toggleVisited(cafe.id)}
          />
          <ActionButton
            label="Rate this Cafe"
            variant="secondary"
            onPress={() => router.push(`/rate/${cafe.id}`)}
          />
          <ActionButton
            label="Open in Google Maps"
            variant="secondary"
            onPress={handleOpenGoogleMaps}
          />
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
  heroStatusPills: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '52%',
    justifyContent: 'flex-end',
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
    fontSize: 26,
    fontFamily: FONTS.display.semibold,
    color: '#faf8f5',
    lineHeight: 32,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroLocation: {
    fontSize: 14,
    fontFamily: FONTS.sans.medium,
    color: 'rgba(250,248,245,0.88)',
    letterSpacing: -0.05,
  },
  featuredBody: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
    gap: 12,
    backgroundColor: COLORS.background,
  },
  tagsScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  tagsWithIcons: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tagWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagWithIconLabel: {
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.15,
  },
  publicScoreWrap: {
    paddingTop: 2,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 56,
  },
  featuredSummary: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
  },
  notesText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    fontStyle: 'italic',
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
    marginTop: 12,
    paddingHorizontal: 20,
    gap: 10,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 26, 0.2)',
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.inputBackground,
    borderColor: COLORS.cardBorder,
  },
  actionButtonAccent: {
    backgroundColor: COLORS.accentSubtleFill,
    borderColor: COLORS.accentSubtleBorder,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
  actionButtonTextSecondary: {
    color: COLORS.text,
  },
  actionButtonTextAccent: {
    color: COLORS.accent,
  },
});
