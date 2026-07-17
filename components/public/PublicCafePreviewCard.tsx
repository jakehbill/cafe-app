import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BeanedPickBadge } from '@/components/BeanedPickBadge';
import { CafeImage } from '@/components/CafeImage';
import { EditorialTag } from '@/components/EditorialTag';
import { VenueTypeBadge } from '@/components/VenueTypeBadge';
import { WorkScoreMetaRow } from '@/components/WorkScoreMetaRow';
import { WorkspaceCardFacts } from '@/components/WorkspaceCardFacts';
import { TrustSignal } from '@/components/TrustSignal';
import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import { prioritizeWorkTagsForCards } from '@/lib/cafeFeaturedTags';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';

const THUMB = 72;

type Props = {
  cafe: Cafe;
  /** Up to 2 tag labels to highlight on the card. */
  highlightTags?: string[];
};

/** Display-only space row for public landing pages — no auth, no navigation hooks. */
export function PublicCafePreviewCard({ cafe, highlightTags }: Props) {
  const photo = resolveLiveCafePrimaryImageUrl({ cafe });
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
        <VenueTypeBadge venueType={cafe.venueType} />
        <Text style={styles.name} numberOfLines={2}>
          {cafe.name}
        </Text>
        {cafe.isCertified ? <BeanedPickBadge /> : null}
        <TrustSignal cafe={cafe} style={styles.trustSignal} />
        <WorkScoreMetaRow cafe={cafe} area={area || null} />
        <WorkspaceCardFacts cafe={cafe} />
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
  trustSignal: {
    marginTop: 0,
  },
  workScore: {
    marginTop: 2,
  },
  meta: {
    fontSize: 13,
    fontFamily: FONTS.sans.regular,
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
