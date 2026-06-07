import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CafeImage } from '@/components/CafeImage';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import { formatPublicCoffeeForCafe } from '@/lib/publicCoffeeDisplay';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';

const THUMB = 72;

type Props = {
  cafe: Cafe;
  /** Up to 2 tag labels to highlight on the card. */
  highlightTags?: string[];
};

/** Display-only café row for public landing pages — no auth, no navigation hooks. */
export function PublicCafePreviewCard({ cafe, highlightTags }: Props) {
  const photo = resolveLiveCafePrimaryImageUrl({ cafe });
  const scoreLabel = formatPublicCoffeeForCafe(cafe);
  const area = (cafe.neighborhood ?? '').trim();
  const tags = (highlightTags ?? cafe.tags).slice(0, 2);

  return (
    <View style={styles.card}>
      <View style={styles.thumbWrap}>
        <CafeImage uri={photo} style={styles.thumb} displayWidth={THUMB} displayHeight={THUMB} priority="low" />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {cafe.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          <Text style={styles.score}>{scoreLabel}</Text>
          {area ? (
            <>
              <Text style={styles.dot}> · </Text>
              <Text>{area}</Text>
            </>
          ) : null}
        </Text>
        {cafe.short_description ? (
          <Text style={styles.summary} numberOfLines={2}>
            {cafe.short_description}
          </Text>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={`${cafe.id}-${tag}`} style={styles.tagChip}>
                <TagWithOptionalIcon tag={tag} iconSize={11} color={COLORS.muted} textStyle={styles.tagText} gap={4} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.imagePlaceholder,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 17,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.25,
  },
  meta: {
    fontSize: 13,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  score: {
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
  },
  dot: {
    color: COLORS.muted,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.tagBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagText: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
});
