import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CafeImage } from '@/components/CafeImage';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { VenueTypeBadge } from '@/components/VenueTypeBadge';
import { WorkScoreMetaRow } from '@/components/WorkScoreMetaRow';
import { WorkspaceCardFacts } from '@/components/WorkspaceCardFacts';
import { TrustSignal } from '@/components/TrustSignal';
import { VisitPhotoLightbox } from '@/components/visit/VisitPhotoLightbox';
import { COLORS, FONTS, SHADOWS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import { prioritizeWorkTagsForCards } from '@/lib/cafeFeaturedTags';
import { formatCoffeeRatingValue } from '@/lib/coffeeRating';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import type { UserCafeVisit } from '@/lib/userCafeVisits';
import type { CafeWorkspaceSummary } from '@/lib/cafeWorkspaceSummary';

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
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const visitPhotoUris = useMemo(() => {
    const fromList = (visit.imageUrls ?? []).map((uri) => String(uri).trim()).filter(Boolean);
    if (fromList.length > 0) return fromList;
    const single = String(visit.imageUrl ?? '').trim();
    return single ? [single] : [];
  }, [visit.imageUrl, visit.imageUrls]);

  const cafeListingUri = resolveLiveCafePrimaryImageUrl({ cafe });
  const hasVisitPhotos = visitPhotoUris.length > 0;
  const mainImageUri = hasVisitPhotos ? visitPhotoUris[0]! : cafeListingUri;
  const showListingOverlay =
    hasVisitPhotos &&
    Boolean(cafeListingUri) &&
    cafeListingUri !== visitPhotoUris[0];

  const area =
    String((cafe as unknown as { area?: unknown }).area ?? '').trim() ||
    String(cafe.neighborhood ?? '').trim();
  const userRatingText =
    visit.rating != null ? `Your rating ${formatCoffeeRatingValue(visit.rating)} ★` : null;

  const notePreview = visit.note.trim().length > 0 ? visit.note.trim() : null;
  const tagSlice = useMemo(
    () => prioritizeWorkTagsForCards(visit.tags.length > 0 ? visit.tags : cafe.tags).slice(0, maxTags),
    [visit.tags, cafe.tags, maxTags]
  );

  const cafeForFacts = useMemo(() => {
    if (cafe.workspaceSummary) return cafe;
    const fromVisit: CafeWorkspaceSummary = {
      stayDuration: visit.stayDuration,
      costToWork: visit.costToWork,
      seatFinding: visit.busyness,
      wifiReliability: visit.wifiReliability,
      coffeeQuality: visit.coffeeQuality,
      foodQuality: visit.foodQuality,
    };
    const hasAny =
      fromVisit.stayDuration ||
      fromVisit.costToWork ||
      fromVisit.seatFinding ||
      fromVisit.wifiReliability;
    if (!hasAny) return cafe;
    return { ...cafe, workspaceSummary: fromVisit };
  }, [cafe, visit]);

  function openLightboxAt(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  return (
    <>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasVisitPhotos ? `View visit photos for ${cafe.name}` : `Open ${cafe.name}`
          }
          onPress={hasVisitPhotos ? () => openLightboxAt(0) : onPress}
          style={({ pressed }) => [styles.mediaColumn, pressed && styles.mediaPressed]}
        >
          <View style={styles.mainImageWrap}>
            {hasVisitPhotos && visitPhotoUris.length > 1 ? (
              <View style={styles.visitGallery}>
                {visitPhotoUris.length === 2 ? (
                  <>
                    <Pressable
                      style={styles.galleryHalf}
                      onPress={(event) => {
                        event.stopPropagation();
                        openLightboxAt(0);
                      }}
                    >
                      <CafeImage
                        uri={visitPhotoUris[0]}
                        style={styles.galleryImage}
                        displayWidth={MAIN_W}
                        displayHeight={MAIN_H}
                        priority="low"
                      />
                    </Pressable>
                    <Pressable
                      style={styles.galleryHalf}
                      onPress={(event) => {
                        event.stopPropagation();
                        openLightboxAt(1);
                      }}
                    >
                      <CafeImage
                        uri={visitPhotoUris[1]}
                        style={styles.galleryImage}
                        displayWidth={MAIN_W}
                        displayHeight={MAIN_H}
                        priority="low"
                      />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.galleryTopRow}>
                      <Pressable
                        style={styles.galleryTopCell}
                        onPress={(event) => {
                          event.stopPropagation();
                          openLightboxAt(0);
                        }}
                      >
                        <CafeImage
                          uri={visitPhotoUris[0]}
                          style={styles.galleryImage}
                          displayWidth={MAIN_W}
                          displayHeight={MAIN_H / 2}
                          priority="low"
                        />
                      </Pressable>
                      <Pressable
                        style={styles.galleryTopCell}
                        onPress={(event) => {
                          event.stopPropagation();
                          openLightboxAt(1);
                        }}
                      >
                        <CafeImage
                          uri={visitPhotoUris[1]}
                          style={styles.galleryImage}
                          displayWidth={MAIN_W}
                          displayHeight={MAIN_H / 2}
                          priority="low"
                        />
                      </Pressable>
                    </View>
                    <Pressable
                      style={styles.galleryBottomCell}
                      onPress={(event) => {
                        event.stopPropagation();
                        openLightboxAt(2);
                      }}
                    >
                      <CafeImage
                        uri={visitPhotoUris[2]}
                        style={styles.galleryImage}
                        displayWidth={MAIN_W}
                        displayHeight={MAIN_H / 2}
                        priority="low"
                      />
                    </Pressable>
                  </>
                )}
              </View>
            ) : mainImageUri ? (
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
            {hasVisitPhotos ? (
              <View style={styles.memoryBadge} pointerEvents="none">
                <Text style={styles.memoryBadgeText}>
                  Your visit{visitPhotoUris.length > 1 ? ` · ${visitPhotoUris.length}` : ''}
                </Text>
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
          <VenueTypeBadge venueType={cafe.venueType} />
          <Text style={styles.name} numberOfLines={2}>
            {cafe.name}
          </Text>
          <TrustSignal cafe={cafe} style={styles.trustSignal} />
          <WorkScoreMetaRow
            cafe={cafe}
            area={area || null}
            style={styles.metaRow}
          />
          <WorkspaceCardFacts cafe={cafeForFacts} style={styles.workspaceFacts} />
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
          {userRatingText ? (
            <Text style={styles.secondaryMeta} numberOfLines={1}>
              {userRatingText}
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
        </Pressable>
      </View>

      {hasVisitPhotos ? (
        <VisitPhotoLightbox
          visible={lightboxOpen}
          imageUris={visitPhotoUris}
          initialIndex={lightboxIndex}
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
  visitGallery: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  galleryHalf: {
    width: '50%',
    height: '100%',
  },
  galleryTopRow: {
    width: '100%',
    height: '50%',
    flexDirection: 'row',
  },
  galleryTopCell: {
    width: '50%',
    height: '100%',
  },
  galleryBottomCell: {
    width: '100%',
    height: '50%',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
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
  curationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  workScore: {
    marginTop: 2,
  },
  metaRow: {
    marginTop: 2,
  },
  trustSignal: {
    marginTop: 2,
  },
  workspaceFacts: {
    marginTop: 2,
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  secondaryMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
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
