import React, { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';

import { type Cafe } from '@/data/cafes';
import { PublicCoffeeScoreText } from '@/components/PublicCoffeeScoreText';
import { EditorialTag } from '@/components/EditorialTag';
import { VenueTypeBadge } from '@/components/VenueTypeBadge';
import { BeanedPickBadge } from '@/components/BeanedPickBadge';
import { WorkScoreMetaRow } from '@/components/WorkScoreMetaRow';
import { WorkspaceCardFacts } from '@/components/WorkspaceCardFacts';
import { TrustSignal } from '@/components/TrustSignal';
import { useCafeState } from '@/contexts/CafeStateContext';
import { resolveCafeDisplayTags } from '@/lib/cafeFeaturedTags';
import { CafeImage } from '@/components/CafeImage';
import { resolveLiveCafePrimaryImageUrl } from '@/lib/cafeLiveImages';
import type { UserTasteProfile } from '@/lib/cafePersonalization';

import { COLORS, FONTS, SHADOWS } from '@/components/theme';

const THUMB = 72;

/** Bottom scrim on list thumbnails so the coffee score badge stays readable on any photo. */
function CompactThumbnailBottomFade({ cafeId }: { cafeId: string }) {
  const gid = `ct_${cafeId.replace(/[^a-zA-Z0-9_]/g, '_')}_bf`;
  const w = THUMB;
  const h = 38;
  return (
    <Svg width={w} height={h} pointerEvents="none" style={styles.thumbnailBottomFade}>
      <Defs>
        <SvgLinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0a0a0a" stopOpacity="0" />
          <Stop offset="0.55" stopColor="#0a0a0a" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#0a0a0a" stopOpacity="0.5" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${gid})`} />
    </Svg>
  );
}

export type CompactCafeCardProps = {
  cafe: Cafe;
  onPress: () => void;
  /** Optional thumbnail override (e.g. visit photo). */
  thumbnailUri?: string;
  /** 1-based rank label (e.g. favorite = 1). */
  rank?: number;
  /** Optional tags (e.g. from a saved rating); up to `maxTags` shown. */
  tags?: string[];
  maxTags?: number;
  /** Taste profile for personal trust signals; omit for community-only. */
  tasteProfile?: UserTasteProfile | null;
  /** Optional visit-note preview shown under tags. */
  notePreview?: string;
  /**
   * Rendered inside the white card row (e.g. visited reorder arrows).
   * Not part of the main press target — use `TouchableOpacity` children.
   */
  trailing?: ReactNode;
  /**
   * When false, the tag row under the coffee score is omitted and tag fetch is skipped.
   * Use on Visited only; default true everywhere else.
   */
  showTagsUI?: boolean;
  /**
   * Where the public coffee score appears (compact list cards only).
   * `bottomRight` (default) — on the thumbnail; Ratings, etc.
   * `cardTopRight` — Search + Saved: ★ score · area · mi, then session/cost; not on image.
   * `contentColumn` — Visited: Work Score block under title; not on image.
   */
  scorePosition?: 'bottomRight' | 'cardTopRight' | 'contentColumn';
  /** Search-only: tighten title + inline metadata block. */
  compactNameMetaGap?: boolean;
  /** Search-only: reserve tag row space even when no tags. */
  reserveTagSpaceWhenEmpty?: boolean;
  /** Optional metadata line override under title. */
  metadataLineOverride?: string;
  /** Optional subtle metadata subline under primary metadata (Visited date, etc.). */
  metadataSublineOverride?: string;
  /** Search-only: enable save/unsave quick action on thumbnail. */
  showBookmarkAction?: boolean;
  /** Optional top-right thumbnail action (e.g. quick "Log visit"). */
  topRightActionLabel?: string;
  onTopRightActionPress?: () => void;
};

export function CompactCafeCard({
  cafe,
  onPress,
  thumbnailUri,
  rank,
  tags,
  maxTags = 3,
  tasteProfile = null,
  notePreview,
  trailing,
  showTagsUI = true,
  scorePosition = 'bottomRight',
  compactNameMetaGap = false,
  reserveTagSpaceWhenEmpty = false,
  metadataLineOverride,
  metadataSublineOverride,
  showBookmarkAction = false,
  topRightActionLabel,
  onTopRightActionPress,
}: CompactCafeCardProps) {
  const { isSaved, toggleSaved } = useCafeState();
  /** Visited list (with trailing): when tags are shown, cap count and lighter styling. */
  const effectiveMaxTags = trailing != null ? Math.min(maxTags, 2) : maxTags;
  const [topTags, setTopTags] = useState<string[]>([]);
  const [optimisticSaved, setOptimisticSaved] = useState<boolean>(isSaved(cafe.id));
  const tagSlice = useMemo(() => {
    if (!showTagsUI) return [];
    if (tags && tags.length > 0) return tags.slice(0, effectiveMaxTags);
    return topTags.slice(0, effectiveMaxTags);
  }, [showTagsUI, tags, topTags, effectiveMaxTags]);
  const showTagRow = showTagsUI && tagSlice.length > 0;
  const tagsSubtle = trailing != null && showTagsUI;
  const primaryPhoto = resolveLiveCafePrimaryImageUrl({
    cafe,
    overrideImageUrl: thumbnailUri,
  });
  const scoreOnCardTopRight = scorePosition === 'cardTopRight';
  const scoreInContentColumn = scorePosition === 'contentColumn';
  const scoreOnThumbnail = !scoreOnCardTopRight && !scoreInContentColumn;
  const metadataLine = buildScoreLocationMeta(cafe);
  const showTagSpacer = reserveTagSpaceWhenEmpty && !showTagRow;
  const saved = optimisticSaved;
  const canShowTopRightAction =
    typeof topRightActionLabel === 'string' &&
    topRightActionLabel.trim().length > 0 &&
    typeof onTopRightActionPress === 'function';

  useEffect(() => {
    setOptimisticSaved(isSaved(cafe.id));
  }, [isSaved, cafe.id]);

  useEffect(() => {
    if (!showTagsUI) return;
    let cancelled = false;
    if (tags && tags.length > 0) {
      setTopTags([]);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const fetched = await resolveCafeDisplayTags(cafe, effectiveMaxTags);
      if (!cancelled) setTopTags(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [cafe.id, effectiveMaxTags, tags, showTagsUI]);

  function handleToggleSave() {
    const next = !saved;
    setOptimisticSaved(next);
    void toggleSaved(cafe.id);
  }

  return (
    <View style={styles.card}>
      {canShowTopRightAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={topRightActionLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPressIn={(event) => {
            event.stopPropagation();
          }}
          onPress={(event) => {
            event.stopPropagation();
            onTopRightActionPress();
          }}
          style={({ pressed }) => [styles.cardTopRightActionButton, pressed && styles.topRightActionButtonPressed]}
        >
          <Text style={styles.cardTopRightActionText}>{topRightActionLabel}</Text>
        </Pressable>
      ) : null}
      {rank != null ? (
        <View style={styles.rankBadge} accessibilityElementsHidden>
          <Text style={styles.rankBadgeText}>#{rank}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${cafe.name}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cardMainPressable,
          (showTagRow || scoreOnCardTopRight || scoreInContentColumn) && styles.cardMainPressableAlignStart,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.thumbnailWrap}>
          <CafeImage
            uri={primaryPhoto}
            style={styles.thumbnailImage}
            displayWidth={THUMB * 2}
            displayHeight={THUMB * 2}
            priority="low"
          />
          {showBookmarkAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? `Remove ${cafe.name} from saved` : `Save ${cafe.name}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPressIn={(event) => {
                event.stopPropagation();
              }}
              onPress={(event) => {
                event.stopPropagation();
                handleToggleSave();
              }}
              style={({ pressed }) => [styles.bookmarkButton, pressed && styles.bookmarkButtonPressed]}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={saved ? COLORS.accent : '#ffffff'}
              />
            </Pressable>
          ) : null}
          {scoreOnThumbnail ? (
            <>
              <CompactThumbnailBottomFade cafeId={cafe.id} />
              <View style={styles.thumbnailScoreWrap} pointerEvents="none">
                <PublicCoffeeScoreText cafe={cafe} variant="overlayThumb" />
              </View>
            </>
          ) : null}
        </View>
        <View style={[styles.body, scoreInContentColumn && styles.bodyContentColumn]}>
          {scoreInContentColumn ? (
            <>
              <View style={[styles.nameMetaStack, compactNameMetaGap && styles.nameMetaStackCompact]}>
                <VenueTypeBadge venueType={cafe.venueType} />
                <Text style={[styles.name, styles.nameContentColumn]} numberOfLines={2}>
                  {cafe.name}
                </Text>
                {cafe.isCertified ? <BeanedPickBadge /> : null}
                <TrustSignal cafe={cafe} tasteProfile={tasteProfile} style={styles.trustSignal} />
                <WorkScoreMetaRow
                  cafe={cafe}
                  area={metadataLineOverride ? undefined : metadataLine.location || null}
                  distance={metadataLineOverride ? undefined : metadataLine.distance || null}
                  style={styles.metaRow}
                />
                {metadataLineOverride ? (
                  <Text style={styles.location} numberOfLines={1}>
                    {metadataLineOverride}
                  </Text>
                ) : null}
                <WorkspaceCardFacts cafe={cafe} style={styles.workspaceFacts} />
              </View>
              {showTagRow ? (
                <View style={[styles.tagsRow, tagsSubtle && styles.tagsRowSubtle]}>
                  {tagSlice.map((tag) => (
                    <EditorialTag
                      key={tag}
                      tag={tag}
                      variant={tagsSubtle ? 'secondary' : 'featured'}
                    />
                  ))}
                </View>
              ) : null}
              {notePreview ? (
                <Text style={styles.notePreviewText} numberOfLines={3}>
                  {notePreview}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <View style={[styles.nameMetaStack, compactNameMetaGap && styles.nameMetaStackCompact]}>
                <VenueTypeBadge venueType={cafe.venueType} />
                <Text style={[styles.name, compactNameMetaGap && styles.nameCompactMetaGap]} numberOfLines={2}>
                  {cafe.name}
                </Text>
                {cafe.isCertified ? <BeanedPickBadge /> : null}
                <TrustSignal
                  cafe={cafe}
                  tasteProfile={tasteProfile}
                  style={[styles.trustSignal, compactNameMetaGap && styles.trustSignalCompact]}
                />
                {scoreOnCardTopRight ? (
                  <>
                    <WorkScoreMetaRow
                      cafe={cafe}
                      area={metadataLineOverride ? undefined : metadataLine.location || null}
                      distance={metadataLineOverride ? undefined : metadataLine.distance || null}
                      style={[styles.metaRow, compactNameMetaGap && styles.locationCompactMetaGap]}
                    />
                    {metadataLineOverride ? (
                      <Text
                        style={[styles.location, compactNameMetaGap && styles.locationCompactMetaGap]}
                        numberOfLines={1}
                      >
                        {metadataLineOverride}
                      </Text>
                    ) : null}
                    <WorkspaceCardFacts cafe={cafe} style={styles.workspaceFacts} />
                  </>
                ) : (
                  <Text
                    style={[styles.location, compactNameMetaGap && styles.locationCompactMetaGap]}
                    numberOfLines={1}
                  >
                    {metadataLineOverride ?? cafe.neighborhood}
                  </Text>
                )}
                {metadataSublineOverride ? (
                  <Text style={styles.metadataSubline} numberOfLines={1}>
                    {metadataSublineOverride}
                  </Text>
                ) : null}
              </View>
              {showTagRow ? (
                <View
                  style={[
                    styles.tagsRow,
                    compactNameMetaGap && styles.tagsRowAfterCompactMeta,
                    tagsSubtle && styles.tagsRowSubtle,
                  ]}
                >
                  {tagSlice.map((tag) => (
                    <EditorialTag
                      key={tag}
                      tag={tag}
                      variant={tagsSubtle ? 'secondary' : 'featured'}
                    />
                  ))}
                </View>
              ) : showTagSpacer ? (
                <View style={[styles.tagsSpacer, compactNameMetaGap && styles.tagsSpacerAfterCompactMeta]} />
              ) : null}
              {notePreview ? (
                <Text style={styles.notePreviewText} numberOfLines={3}>
                  {notePreview}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </Pressable>
      {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

function buildScoreLocationMeta(cafe: Cafe): { location: string; distance: string } {
  const location = (cafe.neighborhood ?? '').trim();
  const distance = (cafe.distanceLabel ?? '').trim();
  return { location, distance };
}

const styles = StyleSheet.create({
  rankBadge: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  rankBadgeText: {
    fontSize: 15,
    fontFamily: FONTS.sans.bold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingRight: 12,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.none,
    gap: 8,
    position: 'relative',
  },
  cardMainPressable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardMainPressableAlignStart: {
    alignItems: 'flex-start',
  },
  cardPressed: {
    opacity: 0.94,
  },
  trailing: {
    flexShrink: 0,
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: 2,
  },
  thumbnailWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.imagePlaceholder,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  thumbnailImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,26,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 3,
  },
  bookmarkButtonPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: 'rgba(26,26,26,0.62)',
  },
  cardTopRightActionButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    zIndex: 3,
  },
  topRightActionButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  cardTopRightActionText: {
    color: COLORS.buttonLabelOnAccent,
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    letterSpacing: -0.1,
  },
  thumbnailBottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  thumbnailScoreWrap: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    zIndex: 2,
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  /**
   * Visited: name → location → score. Single `gap` so spacing is equal between each pair.
   * `name` uses `nameContentColumn` so `flex: 1` does not stretch the title and break even gaps.
   */
  bodyContentColumn: {
    gap: 2,
  },
  nameContentColumn: {
    flex: 0,
    alignSelf: 'stretch',
  },
  nameMetaStack: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    rowGap: 2,
  },
  nameMetaStackCompact: {
    rowGap: 0,
  },
  curationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
    marginBottom: 1,
  },
  workScoreHero: {
    marginTop: 2,
    marginBottom: 1,
  },
  metaRow: {
    marginTop: 1,
    marginBottom: 0,
  },
  workspaceFacts: {
    marginTop: 1,
    marginBottom: 1,
  },
  scoreLocationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'stretch',
    minWidth: 0,
  },
  /** Matches `WorkScoreHero` card score size — numeric only on search/saved meta row. */
  inlineScore: {
    flexShrink: 0,
    fontFamily: FONTS.sans.bold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.35,
    color: COLORS.text,
  },
  inlineScoreDot: {
    flexShrink: 0,
    fontFamily: FONTS.sans.regular,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    opacity: 0.7,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.35,
    lineHeight: 24,
  },
  nameCompactMetaGap: {
    marginBottom: 0,
    lineHeight: 18,
  },
  trustSignal: {
    marginTop: 2,
    marginBottom: 0,
  },
  trustSignalCompact: {
    marginTop: 1,
  },
  notePreviewText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  location: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.05,
    opacity: 0.88,
  },
  locationCompactMetaGap: {
    marginTop: 0,
    marginBottom: 0,
  },
  metadataSubline: {
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.accent,
    fontFamily: FONTS.sans.medium,
    opacity: 0.88,
    marginTop: 1,
    letterSpacing: -0.05,
  },
  locationScore: {
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  locationDot: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    opacity: 0.7,
  },
  locationDistance: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    opacity: 0.82,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  tagsRowAfterCompactMeta: {
    marginTop: 7,
  },
  tagsSpacer: {
    minHeight: 7,
    marginTop: 5,
  },
  tagsSpacerAfterCompactMeta: {
    marginTop: 7,
  },
  tagsRowSubtle: {
    gap: 6,
    marginTop: 3,
    maxWidth: '100%',
  },
});

