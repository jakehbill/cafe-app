import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BeanedPickBadge } from '@/components/BeanedPickBadge';
import { CafeImage } from '@/components/CafeImage';
import { EditorialTag } from '@/components/EditorialTag';
import { VenueTypeBadge } from '@/components/VenueTypeBadge';
import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import { prioritizeWorkTagsForCards } from '@/lib/cafeFeaturedTags';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import { formatWorkScoreCardLabel } from '@/lib/publicCoffeeDisplay';

const THUMB = 72;

type Props = {
  cafe: Cafe;
  /** Up to 2 tag labels to highlight on the card. */
  highlightTags?: string[];
};

/** Display-only space row for public landing pages — no auth, no navigation hooks. */
export function PublicCafePreviewCard({ cafe, highlightTags }: Props) {
  const photo = resolveLiveCafePrimaryImageUrl({ cafe });
  const scoreLabel = formatWorkScoreCardLabel(cafe);
  const area = (cafe.neighborhood ?? '').trim();
  const tags = useMemo(() => {
    const source = highlightTags ?? cafe.tags ?? [];
    return prioritizeWorkTagsForCards(source).slice(0, 2);
  }, [cafe.tags, highlightTags]);

  return (
    <View style={styles.card}>
      <View style={styles.thumbWrap}>
        <CafeImage uri={photo} style={styles.thumb} displayWidth={THUMB} displayHeight={THUMB} priority="low" />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {cafe.name}
        </Text>
        <View style={styles.curationRow}>
          <VenueTypeBadge venueType={cafe.venueType} />
          {cafe.isCertified ? <BeanedPickBadge /> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          <Text style={styles.score}>{scoreLabel}</Text>
          {area ? (
            <>
              <Text style={styles.dot}> · </Text>
              <Text>{area}</Text>
            </>
          ) : null}
        </Text>
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <EditorialTag key={`${cafe.id}-${tag}`} tag={tag} variant="featured" />
            ))}
          </View>
        ) : null}
        {cafe.short_description ? (
          <Text style={styles.summary} numberOfLines={2}>
            {cafe.short_description}
          </Text>
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
  curationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    fontSize: 13,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  score: {
    fontFamily: FONTS.sans.semibold,
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
    marginTop: 2,
  },
});
