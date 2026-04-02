import { useCafeState } from '@/contexts/CafeStateContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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
import type { Cafe } from '../../data/cafes';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { formatPrivateCoffeeOneDecimal, formatPublicCoffeeOutOf5 } from '@/lib/publicCoffeeDisplay';
import { formatTagLabel } from '@/lib/cafeTags';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
const MAX_VISIBLE_TAGS = 3;

function ScorePill({ valueText }: { valueText: string }) {
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scorePillNumeric}>{valueText}</Text>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{formatTagLabel(label)}</Text>
    </View>
  );
}

function ActionButton({
  label,
  variant = 'primary',
  accentActive = false,
  onPress,
}: {
  label: string;
  variant?: 'primary' | 'secondary';
  /** Subtle accent when state is on (e.g. Saved / Visited) — not a solid orange block */
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
  } = useCafeState();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [cafeLoading, setCafeLoading] = useState(true);

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

  /** In-page back above the hero; stack header hidden so the control is visible on all platforms. */
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
          <Text style={styles.notFoundText}>
            We could not find a cafe for this id.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const localRating = getCafeRating(cafe.id);
  /** Tags/notes + coffee for display; public coffee when no local save (no legacy cafe work/vibe in this path). */
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
  const mainCoffeeDisplay = localRating
    ? formatPrivateCoffeeOneDecimal(localRating.coffee)
    : formatPublicCoffeeOutOf5(cafe.publicCoffeeScore);
  const mapsUrl = cafe.googleMapsUrl;
  const hasGoogleMapsUrl =
    typeof mapsUrl === 'string' && mapsUrl.trim().length > 0;

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

  /** Persists to `user_saved_cafes` via context (same source as the Saved tab), not legacy `saves`. */
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          {heroBackRow}
          {cafe.imageUrl ? (
            <Image source={{ uri: cafe.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroImage} />
          )}
        </View>

        <View style={styles.header}>
          <Text style={styles.cafeName}>{cafe.name}</Text>
          <Text style={styles.neighborhood}>{cafe.neighborhood}</Text>
          {localRating ? (
            <View style={styles.ratedBadge}>
              <Text style={styles.ratedBadgeText}>Rated by you</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Rating</Text>
          <View style={styles.scoresGrid}>
            <ScorePill valueText={mainCoffeeDisplay} />
          </View>
          {cafe.coffeeRatingCount > 0 && cafe.publicCoffeeScore != null ? (
            <View style={styles.avgWrap}>
              <Text style={styles.avgLabel}>Average from ratings</Text>
              <View style={styles.avgLine}>
                <Text style={styles.avgNumeric}>{formatPublicCoffeeOutOf5(cafe.publicCoffeeScore)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsRow}>
            {displayTags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text numberOfLines={3} style={styles.summaryText}>
            {cafe.summary}
          </Text>
        </View>
        {ratingSource.notes ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text numberOfLines={3} style={styles.summaryText}>
              {ratingSource.notes}
            </Text>
          </View>
        ) : null}

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
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  heroBackRow: {
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  heroBackHit: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.imagePlaceholder,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.none,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 6,
  },
  cafeName: {
    fontSize: 32,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  neighborhood: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 20,
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
  },
  ratedBadgeText: {
    fontSize: 12,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
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

  sectionCard: {
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 12,
    ...SHADOWS.card,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },

  scoresGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  scorePill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    alignItems: 'center',
    gap: 2,
  },
  scorePillNumeric: {
    fontSize: 22,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  scoreValue: {
    fontSize: 28,
    fontFamily: FONTS.sans.bold,
    color: COLORS.text,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  avgWrap: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    gap: 4,
  },
  avgLabel: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.2,
  },
  avgLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgNumeric: {
    fontSize: 22,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagText: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: FONTS.sans.medium,
  },

  summaryText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
  },

  actionsWrap: {
    marginTop: 20,
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

