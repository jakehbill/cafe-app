import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { cafes } from '../../data/cafes';

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

function ScorePill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'espresso' | 'sage' | 'neutral';
}) {
  const toneStyle =
    tone === 'espresso'
      ? styles.scorePillEspresso
      : tone === 'sage'
        ? styles.scorePillSage
        : styles.scorePillNeutral;

  const labelStyle =
    tone === 'espresso'
      ? styles.scoreLabelEspresso
      : tone === 'sage'
        ? styles.scoreLabelSage
        : styles.scoreLabelNeutral;

  return (
    <View style={[styles.scorePill, toneStyle]}>
      <Text style={[styles.scoreLabel, labelStyle]}>{label}</Text>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroImage} />

        <View style={styles.header}>
          <Text style={styles.cafeName}>{cafe.name}</Text>
          <Text style={styles.neighborhood}>{cafe.neighborhood}</Text>
          {cafeId ? <Text style={styles.routeHint}>Cafe id: {cafeId}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Scores</Text>
          <View style={styles.scoresGrid}>
            <ScorePill label="Coffee score" value={cafe.coffeeScore.toFixed(1)} tone="espresso" />
            <ScorePill label="Work score" value={cafe.workScore.toFixed(1)} tone="sage" />
            <ScorePill label="Vibe score" value={cafe.vibeScore.toFixed(1)} tone="neutral" />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Vibe</Text>
          <View style={styles.tagsRow}>
            {cafe.tags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryText}>{cafe.summary}</Text>
        </View>

        <View style={styles.actionsWrap}>
          <ActionButton label="Save" variant="primary" />
          <ActionButton label="Mark Visited" variant="secondary" />
          <ActionButton
            label="Rate this Cafe"
            variant="secondary"
            onPress={() => router.push(`/rate/${cafe.id}`)}
          />
          <ActionButton label="Share" variant="secondary" />
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
    paddingBottom: 28,
  },

  heroImage: {
    height: 280,
    backgroundColor: COLORS.image,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 6,
  },
  cafeName: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
    lineHeight: 34,
  },
  neighborhood: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  routeHint: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
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
    marginTop: 14,
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
  },

  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scorePill: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
  },
  scorePillNeutral: {
    backgroundColor: COLORS.input,
    borderColor: COLORS.border,
  },
  scorePillEspresso: {
    backgroundColor: 'rgba(138, 106, 79, 0.12)',
    borderColor: 'rgba(138, 106, 79, 0.35)',
  },
  scorePillSage: {
    backgroundColor: 'rgba(163, 177, 138, 0.18)',
    borderColor: 'rgba(163, 177, 138, 0.45)',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  scoreLabelNeutral: {
    color: COLORS.muted,
  },
  scoreLabelEspresso: {
    color: COLORS.espresso,
  },
  scoreLabelSage: {
    color: '#5B6E58',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  summaryText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },

  actionsWrap: {
    marginTop: 16,
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
    backgroundColor: COLORS.input,
    borderColor: COLORS.border,
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

