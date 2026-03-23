import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';

type CafeCardProps = {
  cafeName?: string;
  neighborhood?: string;
  coffeeScoreLabel?: string;
  coffeeScoreValue?: string;
  workScoreLabel?: string;
  workScoreValue?: string;
  tags?: string[];
  summary?: string;
};

export function CafeCard({
  cafeName = 'Moss & Co. Coffee',
  neighborhood = 'Downtown • Elm Street',
  coffeeScoreLabel = 'Coffee score',
  coffeeScoreValue = '9.4',
  workScoreLabel = 'Work score',
  workScoreValue = '8.7',
  tags = ['Specialty', 'Fast Wi‑Fi', 'Quiet corners'],
  summary = 'Cozy light-filled seating with consistently great pour-overs.',
}: CafeCardProps) {
  return (
    <View style={styles.featuredCard}>
      <View style={styles.imagePlaceholder} />

      <View style={styles.cardBody}>
        <Text style={styles.cafeName}>{cafeName}</Text>
        <Text style={styles.neighborhoodText}>{neighborhood}</Text>

        <View style={styles.scoresRow}>
          <View style={[styles.scorePill, styles.scorePillCoffee]}>
            <Text style={[styles.scoreLabel, styles.scoreLabelCoffee]}>
              {coffeeScoreLabel}
            </Text>
            <Text style={styles.scoreValue}>{coffeeScoreValue}</Text>
          </View>

          <View style={[styles.scorePill, styles.scorePillWork]}>
            <Text style={[styles.scoreLabel, styles.scoreLabelWork]}>
              {workScoreLabel}
            </Text>
            <Text style={styles.scoreValue}>{workScoreValue}</Text>
          </View>
        </View>

        <View style={styles.tagsRow}>
          {tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.summaryText}>{summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  featuredCard: {
    marginTop: 6,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: COLORS.imagePlaceholder,
  },
  cardBody: {
    padding: 14,
    gap: 10,
  },
  cafeName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 22,
  },
  neighborhoodText: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },

  scoresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scorePill: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  scorePillCoffee: {
    backgroundColor: COLORS.coffeePillBackground,
    borderColor: COLORS.coffeePillBorder,
  },
  scorePillWork: {
    backgroundColor: COLORS.workPillBackground,
    borderColor: COLORS.workPillBorder,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  scoreLabelCoffee: {
    color: COLORS.roastedBrown,
  },
  scoreLabelWork: {
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
    backgroundColor: COLORS.tagBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  summaryText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});

