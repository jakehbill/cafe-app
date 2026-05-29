import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CafeImage } from '@/components/CafeImage';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { VisitPhotoLightbox } from '@/components/visit/VisitPhotoLightbox';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import { formatCoffeeRatingValue } from '@/lib/coffeeRating';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import type { UserCafeVisit } from '@/lib/userCafeVisits';

const MAIN_W = 96;
const MAIN_H = 118;
const OVERLAY_SIZE = 38;

export type VisitedCafeDiaryCardProps = {
  cafe: Cafe;
  visit: UserCafeVisit;
  visitedDateLabel: string | null;
  onPress: () => void;
  maxTags?: number;
};

/**
 * Visited-cafés list row: visit photo forward, café listing image as secondary overlay.
 */
export function VisitedCafeDiaryCard({
  cafe,
  visit,
  visitedDateLabel,
  onPress,
  maxTags = 3,
}: VisitedCafeDiaryCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const visitPhotoUri = String(visit.imageUrl ?? '').trim() || null;
  const cafeListingUri = resolveLiveCafePrimaryImageUrl({ cafe });
  const hasVisitPhoto = Boolean(visitPhotoUri);
  const mainImageUri = hasVisitPhoto ? visitPhotoUri! : cafeListingUri;
  const showListingOverlay =
    hasVisitPhoto &&
    Boolean(cafeListingUri) &&
    cafeListingUri !== visitPhotoUri;

  const area =
    String((cafe as unknown as { area?: unknown }).area ?? '').trim() ||
    String(cafe.neighborhood ?? '').trim();
  const userRatingText =
    visit.rating != null ? `${formatCoffeeRatingValue(visit.rating)} ★` : null;
  const metaParts = [userRatingText, area].filter(Boolean);
  const metaLine = metaParts.join(' · ');

  const notePreview = visit.note.trim().length > 0 ? visit.note.trim() : null;
  const tagSlice = useMemo(
    () => (visit.tags.length > 0 ? visit.tags.slice(0, maxTags) : []),
    [visit.tags, maxTags]
  );

  return (
    <>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasVisitPhoto ? `View visit photo for ${cafe.name}` : `Open ${cafe.name}`
          }
          onPress={hasVisitPhoto ? () => setLightboxOpen(true) : onPress}
          style={({ pressed }) => [styles.mediaColumn, pressed && styles.mediaPressed]}
        >
          <View style={styles.mainImageWrap}>
            {mainImageUri ? (
              <CafeImage
                uri={mainImageUri}
                style={styles.mainImage}
                displayWidth={MAIN_W * 2}
                displayHeight={MAIN_H * 2}
                priority="low"
              />
            ) : (
              <View style={[styles.mainImage, styles.mainImagePlaceholder]} />
            )}
            {hasVisitPhoto ? (
              <View style={styles.memoryBadge} pointerEvents="none">
                <Text style={styles.memoryBadgeText}>Your visit</Text>
              </View>
            ) : null}
            {showListingOverlay && cafeListingUri ? (
              <View style={styles.listingOverlayWrap} pointerEvents="none">
                <CafeImage
                  uri={cafeListingUri}
                  style={styles.listingOverlayImage}
                  displayWidth={OVERLAY_SIZE * 2}
                  displayHeight={OVERLAY_SIZE * 2}
                  priority="low"
                />
              </View>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${cafe.name}`}
          onPress={onPress}
          style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
        >
        <Text style={styles.name} numberOfLines={2}>
          {cafe.name}
        </Text>
        {metaLine.length > 0 ? (
          <Text style={styles.metaLine} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}
        {visitedDateLabel ? (
          <Text style={styles.dateLine} numberOfLines={1}>
            {visitedDateLabel}
          </Text>
        ) : null}
        {notePreview ? (
          <Text style={styles.notePreview} numberOfLines={2}>
            {notePreview}
          </Text>
        ) : null}
        {tagSlice.length > 0 ? (
          <View style={styles.tagsRow}>
            {tagSlice.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <TagWithOptionalIcon
                  tag={tag}
                  iconSize={11}
                  color={COLORS.muted}
                  textStyle={styles.tagChipText}
                  gap={4}
                />
              </View>
            ))}
          </View>
        ) : null}
        </Pressable>
      </View>

      {hasVisitPhoto && visitPhotoUri ? (
        <VisitPhotoLightbox
          visible={lightboxOpen}
          imageUri={visitPhotoUri}
          title={cafe.name}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 18,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
    paddingRight: 14,
    ...SHADOWS.card,
  },
  mediaColumn: {
    flexShrink: 0,
  },
  mediaPressed: {
    opacity: 0.9,
  },
  bodyPressed: {
    opacity: 0.96,
  },
  mainImageWrap: {
    width: MAIN_W,
    height: MAIN_H,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.imagePlaceholder,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  mainImagePlaceholder: {
    backgroundColor: COLORS.imagePlaceholder,
  },
  memoryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 26, 0.08)',
  },
  memoryBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  listingOverlayWrap: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: OVERLAY_SIZE,
    height: OVERLAY_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.background,
    backgroundColor: COLORS.imagePlaceholder,
    ...SHADOWS.card,
  },
  listingOverlayImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
  },
  dateLine: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  notePreview: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagChipText: {
    fontSize: 11,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
  },
});
