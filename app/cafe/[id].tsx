import { useCafeState } from '@/contexts/CafeStateContext';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useState } from 'react';
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
import { CoffeeCupRating } from '@/components/CoffeeCupRating';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { formatTagLabel } from '@/lib/cafeTags';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
const MAX_VISIBLE_TAGS = 3;

function ScorePill({
  label,
  value,
}: {
  label?: string;
  value: number;
}) {
  return (
    <View style={styles.scorePill}>
      {label ? <Text style={styles.scoreLabel}>{label}</Text> : null}
      <CoffeeCupRating value={value} size={20} />
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: cafe?.name ?? 'Cafe',
      headerTitleStyle: {
        fontFamily: FONTS.sans.semibold,
        fontSize: 17,
        color: COLORS.text,
      },
    });
  }, [cafe?.name, navigation]);

  const routeCafeId = cafeId ? String(cafeId) : '';

  const [avgScores, setAvgScores] = useState<{ coffee: number; work: number; vibe: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAverages() {
      const numericCafeId = Number.parseInt(routeCafeId, 10);
      if (!Number.isFinite(numericCafeId)) return;

      const res = await supabase
        .from('ratings')
        .select('coffee:coffee_rating.avg(), work:work_rating.avg(), vibe:vibe_rating.avg()')
        .eq('cafe_id', numericCafeId)
        .maybeSingle();

      if (cancelled) return;
      if (res.error) {
        console.error('Failed to load average ratings:', res.error);
        return;
      }

      const coffee = res.data?.coffee;
      const work = res.data?.work;
      const vibe = res.data?.vibe;
      if (typeof coffee === 'number' && typeof work === 'number' && typeof vibe === 'number') {
        setAvgScores({ coffee, work, vibe });
      } else {
        setAvgScores(null);
      }
    }

    void loadAverages();
    return () => {
      cancelled = true;
    };
  }, [routeCafeId]);

  if (cafeLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.notFoundWrap}>
          <ActivityIndicator size="large" color={COLORS.muted} />
        </View>
      </SafeAreaView>
    );
  }

  if (!cafe) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
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
  // Prefer the user’s saved rating; otherwise use listing scores from Supabase `cafes`.
  const ratingSource = localRating
    ? {
        coffee: localRating.coffee,
        work: localRating.work,
        vibe: localRating.vibe,
        tags: localRating.tags,
        notes: localRating.notes,
      }
    : {
        coffee: cafe.coffeeScore,
        work: cafe.workScore,
        vibe: cafe.vibeScore,
        tags: cafe.tags,
        notes: '',
      };
  const displayTags = ratingSource.tags.slice(0, MAX_VISIBLE_TAGS);
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
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
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
            <ScorePill value={ratingSource.coffee} />
          </View>
          {avgScores ? (
            <View style={styles.avgWrap}>
              <Text style={styles.avgLabel}>Average from ratings</Text>
              <View style={styles.avgLine}>
                <CoffeeCupRating value={avgScores.coffee} size={16} />
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
    paddingTop: 14,
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

