import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from './theme';

type CafeCardProps = {
  cafeName?: string;
  neighborhood?: string;
  coffeeScoreLabel?: string;
  coffeeScoreValue?: string;
  workScoreLabel?: string;
  workScoreValue?: string;
  vibeScoreLabel?: string;
  vibeScoreValue?: string;
  tags?: string[];
  summary?: string;
  onPress?: () => void;
};

export function CafeCard({
  cafeName = 'Moss & Co. Coffee',
  neighborhood = 'Downtown • Elm Street',
  coffeeScoreLabel = 'Coffee score',
  coffeeScoreValue = '9.4',
  workScoreLabel = 'Work score',
  workScoreValue = '8.7',
  vibeScoreLabel = 'Vibe',
  vibeScoreValue,
  tags = ['Specialty', 'Fast Wi‑Fi', 'Quiet corners'],
  summary = 'Cozy light-filled seating with consistently great pour-overs.',
  onPress,
}: CafeCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.featuredCard} onPress={onPress}>
      <View style={styles.imagePlaceholder} />

      <View style={styles.cardBody}>
        <View style={styles.headerBlock}>
          <Text style={styles.cafeName}>{cafeName}</Text>
          <Text style={styles.neighborhoodText}>{neighborhood}</Text>
        </View>

        <View style={styles.scoresRow}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, styles.scoreLabelCoffee]}>{coffeeScoreLabel}</Text>
            <Text style={styles.scoreValue}>{coffeeScoreValue}</Text>
          </View>

          <View style={styles.scoreDot} />

          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, styles.scoreLabelWork]}>{workScoreLabel}</Text>
            <Text style={styles.scoreValue}>{workScoreValue}</Text>
          </View>

          {vibeScoreValue ? (
            <>
              <View style={styles.scoreDot} />
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreLabel, styles.scoreLabelVibe]}>{vibeScoreLabel}</Text>
                <Text style={styles.scoreValueSubtle}>{vibeScoreValue}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.tagsRow}>
          {tags.slice(0, 5).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryDivider} />
        <Text numberOfLines={2} style={styles.summaryText}>
          {summary}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  featuredCard: {
    marginTop: 6,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE4D6',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: COLORS.imagePlaceholder,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
  },
  headerBlock: {
    gap: 4,
  },
  cafeName: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  neighborhoodText: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },

  scoresRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scoreDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#C9BEAF',
    marginBottom: 6,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  scoreLabelCoffee: {
    color: COLORS.text,
  },
  scoreLabelWork: {
    color: COLORS.text,
  },
  scoreLabelVibe: {
    color: '#7E7265',
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  scoreValueSubtle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#7E7265',
    lineHeight: 28,
    letterSpacing: -0.4,
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
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFE7DB',
    marginTop: 2,
  },

  summaryText: {
    color: '#4F4740',
    fontSize: 14,
    lineHeight: 22,
  },
});

