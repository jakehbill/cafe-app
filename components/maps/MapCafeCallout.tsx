import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import { formatPublicCoffeeForCafe } from '@/lib/publicCoffeeDisplay';

export type MapCafeCalloutProps = {
  cafe: Cafe;
};

/**
 * Compact map marker preview card for opening cafe detail.
 */
export function MapCafeCallout({ cafe }: MapCafeCalloutProps) {
  const imageUrl = resolveLiveCafePrimaryImageUrl({ cafe });
  const metadata = buildMapMetadataLine(cafe);

  return (
    <View style={styles.root}>
      <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="cover" />
      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {cafe.name}
          </Text>
          {metadata ? (
            <Text style={styles.meta} numberOfLines={1}>
              {metadata}
            </Text>
          ) : null}
        </View>
        <View style={styles.openPill}>
          <Text style={styles.openPillText}>Open</Text>
          <Ionicons
            name="chevron-forward"
            size={13}
            color={COLORS.accent}
            style={styles.arrow}
          />
        </View>
      </View>
    </View>
  );
}

function buildMapMetadataLine(cafe: Cafe): string {
  const parts: string[] = [];
  const score = formatPublicCoffeeForCafe(cafe).trim();
  if (score && score !== '\u2014') parts.push(`${score} \u2605`);

  const neighborhood = (cafe.neighborhood ?? '').trim();
  if (neighborhood.length > 0) parts.push(neighborhood);

  const distance = (cafe.distanceLabel ?? '').trim();
  if (distance.length > 0) parts.push(distance);

  return parts.join(' \u2022 ');
}

const styles = StyleSheet.create({
  root: {
    minWidth: 214,
    maxWidth: 250,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  thumb: {
    width: '100%',
    height: 92,
    backgroundColor: COLORS.imagePlaceholder,
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  textBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  title: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: FONTS.sans.semibold,
    letterSpacing: -0.15,
  },
  meta: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    backgroundColor: COLORS.accentSubtleFill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  openPillText: {
    color: COLORS.accent,
    fontSize: 11,
    lineHeight: 13,
    fontFamily: FONTS.sans.semibold,
  },
  arrow: {
    marginTop: 0.5,
  },
});
