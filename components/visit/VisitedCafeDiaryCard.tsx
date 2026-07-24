import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
import { cafeHasPublicWorkScore } from '@/lib/publicCoffeeDisplay';
import type { UserCafeVisit } from '@/lib/userCafeVisits';
import type { CafeWorkspaceSummary } from '@/lib/cafeWorkspaceSummary';
import { buildWorkspaceCardFactParts } from '@/lib/cafeWorkspaceSummary';
import { useDesktopWeb } from '@/hooks/use-desktop-web';

const MAIN_W = 76;
const MAIN_H = 92;
const MAIN_W_DESKTOP = 88;
const MAIN_H_DESKTOP = 104;
const OVERLAY_SIZE = 32;

export type VisitedCafeDiaryCardProps = {
  cafe: Cafe;
  visit: UserCafeVisit;
  visitedDateLabel: string | null;
  onPress: () => void;
  maxTags?: number;
};

/**
 * Compact visited-space diary row: essentials collapsed, details on expand, review in modal.
 */
export function VisitedCafeDiaryCard({
  cafe,
  visit,
  visitedDateLabel,
  onPress,
  maxTags = 3,
}: VisitedCafeDiaryCardProps) {
  const { isDesktopWeb } = useDesktopWeb();
  const mediaW = isDesktopWeb ? MAIN_W_DESKTOP : MAIN_W;
  const mediaH = isDesktopWeb ? MAIN_H_DESKTOP : MAIN_H;

  const [expanded, setExpanded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
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

  const noteText = visit.note.trim().length > 0 ? visit.note.trim() : null;
  const hasRating = visit.rating != null && Number.isFinite(visit.rating);
  const ratingLabel = hasRating ? formatCoffeeRatingValue(visit.rating) : null;

  const tagSlice = useMemo(
    () =>
      prioritizeWorkTagsForCards(visit.tags.length > 0 ? visit.tags : cafe.tags).slice(0, maxTags),
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

  const hasMultiVisitPhotos = hasVisitPhotos && visitPhotoUris.length > 1;
  const hasWorkspaceFacts = buildWorkspaceCardFactParts(cafeForFacts).length > 0;
  const hasPublicWorkScore = cafeHasPublicWorkScore(cafe);
  const hasExpandableDetails =
    hasMultiVisitPhotos ||
    tagSlice.length > 0 ||
    hasWorkspaceFacts ||
    hasPublicWorkScore ||
    Boolean(cafe.isCertified);

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
          <View style={[styles.mainImageWrap, { width: mediaW, height: mediaH }]}>
            {mainImageUri ? (
              <CafeImage
                uri={mainImageUri}
                style={styles.mainImage}
                displayWidth={mediaW * 2}
                displayHeight={mediaH * 2}
                priority="low"
              />
            ) : (
              <View style={[styles.mainImage, styles.mainImagePlaceholder]} />
            )}
            {hasVisitPhotos ? (
              <View style={styles.memoryBadge} pointerEvents="none">
                <Text style={styles.memoryBadgeText}>
                  {visitPhotoUris.length > 1 ? `${visitPhotoUris.length} photos` : 'Visit'}
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

        <View style={styles.body}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${cafe.name}`}
            onPress={onPress}
            style={({ pressed }) => [styles.bodyMain, pressed && styles.bodyPressed]}
          >
            <VenueTypeBadge venueType={cafe.venueType} />
            <Text style={styles.name} numberOfLines={2}>
              {cafe.name}
            </Text>
            {area ? (
              <Text style={styles.areaLine} numberOfLines={1}>
                {area}
              </Text>
            ) : null}

            <View style={styles.metaChipRow}>
              {visitedDateLabel ? (
                <View style={styles.visitedChip}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.sage} />
                  <Text style={styles.visitedChipText} numberOfLines={1}>
                    {visitedDateLabel}
                  </Text>
                </View>
              ) : null}
              {ratingLabel ? (
                <View style={styles.ratingChip}>
                  <Ionicons name="star" size={11} color="#5B6E58" />
                  <Text style={styles.ratingChipText}>{ratingLabel}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          <View style={styles.actionRow}>
            {noteText ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View review"
                onPress={() => setReviewOpen(true)}
                style={({ pressed }) => [styles.reviewButton, pressed && styles.actionPressed]}
                hitSlop={6}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.roastedBrown} />
                <Text style={styles.reviewButtonText}>View review</Text>
              </Pressable>
            ) : (
              <View style={styles.actionSpacer} />
            )}

            {hasExpandableDetails ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={expanded ? 'Hide visit details' : 'Show more visit details'}
                onPress={() => setExpanded((prev) => !prev)}
                style={({ pressed }) => [styles.moreButton, pressed && styles.actionPressed]}
                hitSlop={8}
              >
                <Text style={styles.moreButtonText}>{expanded ? 'Less' : 'More'}</Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.muted}
                />
              </Pressable>
            ) : null}
          </View>

          {expanded ? (
            <View style={styles.expandedBlock}>
              {hasMultiVisitPhotos ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photoStrip}
                >
                  {visitPhotoUris.map((uri, index) => (
                    <Pressable
                      key={`${uri}-${index}`}
                      onPress={() => openLightboxAt(index)}
                      style={styles.photoThumbWrap}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={`Visit photo ${index + 1}`}
                    >
                      <CafeImage
                        uri={uri}
                        style={styles.photoThumb}
                        displayWidth={112}
                        displayHeight={84}
                        priority="low"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <TrustSignal cafe={cafe} style={styles.trustSignal} />
              {hasPublicWorkScore ? (
                <WorkScoreMetaRow cafe={cafe} area={area || null} style={styles.metaRow} />
              ) : null}
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
            </View>
          ) : null}
        </View>
      </View>

      <Modal
        visible={reviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReviewOpen(false)}>
          <Pressable
            style={styles.modalCard}
            onPress={(event) => event.stopPropagation()}
            accessibilityRole="summary"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalEyebrow}>Your review</Text>
              <Pressable
                onPress={() => setReviewOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close review"
              >
                <Ionicons name="close" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <Text style={styles.modalCafeName} numberOfLines={2}>
              {cafe.name}
            </Text>
            {visitedDateLabel || ratingLabel ? (
              <View style={styles.modalMetaRow}>
                {visitedDateLabel ? (
                  <Text style={styles.modalMetaText}>{visitedDateLabel}</Text>
                ) : null}
                {ratingLabel ? (
                  <View style={styles.ratingChip}>
                    <Ionicons name="star" size={11} color="#5B6E58" />
                    <Text style={styles.ratingChipText}>{ratingLabel}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalBody}>{noteText}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
    gap: 12,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 10,
    paddingRight: 12,
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
    borderRadius: 12,
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
    top: 5,
    left: 5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 251, 240, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(138, 154, 126, 0.35)',
  },
  memoryBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.sans.semibold,
    color: '#5B6E58',
    letterSpacing: 0.15,
  },
  listingOverlayWrap: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    width: OVERLAY_SIZE,
    height: OVERLAY_SIZE,
    borderRadius: 8,
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
    gap: 8,
    paddingTop: 1,
  },
  bodyMain: {
    gap: 3,
  },
  name: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  areaLine: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  metaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  visitedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.workPillBackground,
    borderWidth: 1,
    borderColor: COLORS.workPillBorder,
  },
  visitedChipText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONTS.sans.medium,
    color: '#5B6E58',
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(138, 154, 126, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(138, 154, 126, 0.4)',
  },
  ratingChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONTS.sans.semibold,
    color: '#5B6E58',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  actionSpacer: {
    flex: 1,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(107, 94, 82, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(107, 94, 82, 0.22)',
  },
  reviewButtonText: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.roastedBrown,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  moreButtonText: {
    fontSize: 12,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
  },
  actionPressed: {
    opacity: 0.75,
  },
  expandedBlock: {
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  photoStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  photoThumbWrap: {
    width: 72,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.imagePlaceholder,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  trustSignal: {
    marginTop: 2,
  },
  metaRow: {
    marginTop: 0,
  },
  workspaceFacts: {
    marginTop: 0,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 20, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    maxHeight: '70%',
    borderRadius: 18,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    ...SHADOWS.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalEyebrow: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.sage,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  modalCafeName: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  modalMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  modalMetaText: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
  },
});
