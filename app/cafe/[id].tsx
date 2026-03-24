import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { cafes } from '../../data/cafes';
import { useAuth } from '@/contexts/AuthContext';
import { useCafeState } from '@/contexts/CafeStateContext';

const COLORS = {
  background: '#F7F3EE',
  text: '#2E2A27',
  muted: '#6E6254',
  border: '#E6DCCB',
  card: '#F2EBDD',
  input: '#EFE8DC',
  image: '#E9E2D6',
  espresso: '#8A6A4F',
  sage: '#A3B18A',
} as const;
const MAX_VISIBLE_TAGS = 3;

function ScorePill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  variant = 'primary',
  onPress,
}: {
  label: string;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.actionButton, variant === 'secondary' && styles.actionButtonSecondary]}
      onPress={onPress}
    >
      <Text style={[styles.actionButtonText, variant === 'secondary' && styles.actionButtonTextSecondary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CafeDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    toggleSaved,
    toggleVisited,
    isSaved,
    isVisited,
    getCafeRating,
  } = useCafeState();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const cafe = cafes.find((item) => item.id === cafeId);

  if (!cafe) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
  // Prioritize user-submitted local ratings when available, otherwise fallback to mock data.
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

  const saveCafeId = cafe.id;
  async function handleSavePress() {
    console.log('SAVE pressed');
    console.log('current cafe id:', saveCafeId);
    console.log('current logged-in user id:', user?.id ?? '(none)');
    await toggleSaved(saveCafeId);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <View style={styles.heroImage} />
        </View>

        <View style={styles.header}>
          <Text style={styles.cafeName}>{cafe.name}</Text>
          <Text style={styles.neighborhood}>{cafe.neighborhood}</Text>
          {localRating ? (
            <View style={styles.ratedBadge}>
              <Text style={styles.ratedBadgeText}>Rated by you</Text>
            </View>
          ) : null}
          {cafeId ? <Text style={styles.routeHint}>Cafe id: {cafeId}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Scores</Text>
          <View style={styles.scoresGrid}>
            <ScorePill label="Coffee" value={ratingSource.coffee.toFixed(1)} />
            <ScorePill label="Work" value={ratingSource.work.toFixed(1)} />
            <ScorePill label="Vibe" value={ratingSource.vibe.toFixed(1)} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Vibe</Text>
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
            variant="primary"
            onPress={() => void handleSavePress()}
          />
          <ActionButton
            label={isVisited(cafe.id) ? 'Visited' : 'Mark Visited'}
            variant="secondary"
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
    paddingBottom: 36,
  },
  heroWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.image,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
    gap: 5,
  },
  cafeName: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  neighborhood: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 20,
  },
  routeHint: {
    fontSize: 12,
    color: COLORS.muted,
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
  },
  ratedBadgeText: {
    fontSize: 12,
    color: '#4A5A49',
    fontWeight: '600',
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
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  notFoundText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
  },

  sectionCard: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE2D4',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
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
    borderColor: '#E8DECE',
    backgroundColor: '#F2EBDD',
    alignItems: 'center',
    gap: 2,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F5346',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 30,
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
    backgroundColor: '#F8F5F0',
    borderWidth: 1,
    borderColor: '#ECE2D3',
  },
  tagText: {
    color: '#5E5348',
    fontSize: 12,
    fontWeight: '500',
  },

  summaryText: {
    color: '#4F4740',
    fontSize: 14,
    lineHeight: 22,
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
    backgroundColor: COLORS.espresso,
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 79, 0.55)',
  },
  actionButtonSecondary: {
    backgroundColor: '#F2EBDD',
    borderColor: '#E7DDCD',
  },
  actionButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButtonTextSecondary: {
    color: COLORS.text,
  },
});

