import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import {
  DEFAULT_PHOTO_SHARING_PREFERENCE,
  shouldShowPhotoShareToggle,
  type PhotoSharingPreference,
} from '@/lib/photoSharingPreference';
import { MAX_VISIT_PHOTOS } from '@/lib/visitPhotoLimits';

export type VisitPhotoPreview = {
  uri: string;
  key?: string;
};

type Props = {
  photos: VisitPhotoPreview[];
  onPressAdd: () => void;
  onPressRemove?: (index: number) => void;
  uploading?: boolean;
  disabled?: boolean;
  error?: string | null;
  success?: string | null;
  addLabel?: string;
  /** When set, hides the trailing “Add” tile once this many previews are shown. */
  maxPhotos?: number;
  /**
   * Community sharing opt-in (default OFF).
   * Only shown when preference is `ask_every_time`.
   */
  sharePublicly?: boolean;
  onSharePubliclyChange?: (next: boolean) => void;
  /** Future account setting — defaults to ask every time. */
  sharingPreference?: PhotoSharingPreference | null;
};

/**
 * Personal visit photos on log/rate flows — private by default; sharing is optional.
 */
export function VisitPhotosSection({
  photos,
  onPressAdd,
  onPressRemove,
  uploading = false,
  disabled = false,
  error,
  success,
  addLabel = `Add up to ${MAX_VISIT_PHOTOS} photos`,
  maxPhotos = MAX_VISIT_PHOTOS,
  sharePublicly = false,
  onSharePubliclyChange,
  sharingPreference = DEFAULT_PHOTO_SHARING_PREFERENCE,
}: Props) {
  const hasPhotos = photos.length > 0;
  const addDisabled = disabled || uploading;
  const atMax = maxPhotos != null && photos.length >= maxPhotos;
  const showShareToggle =
    typeof onSharePubliclyChange === 'function' && shouldShowPhotoShareToggle(sharingPreference);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Photos</Text>
      <Text style={styles.subtitle}>Add photos to remember this workspace.</Text>

      {hasPhotos ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          keyboardShouldPersistTaps="handled"
        >
          {photos.map((photo, index) => (
            <View key={photo.key ?? `${photo.uri}-${index}`} style={styles.thumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} resizeMode="cover" />
              {uploading && index === photos.length - 1 ? (
                <View style={styles.thumbOverlay}>
                  <ActivityIndicator color={COLORS.accent} />
                </View>
              ) : null}
              {onPressRemove && !uploading ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove visit photo"
                  onPress={() => onPressRemove(index)}
                  style={styles.removeChip}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={COLORS.text} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {!atMax ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              onPress={onPressAdd}
              disabled={addDisabled}
              style={({ pressed }) => [
                styles.addSlotCompact,
                addDisabled && styles.addSlotDisabled,
                pressed && !addDisabled && styles.addSlotPressed,
              ]}
            >
              <Ionicons name="add" size={28} color={COLORS.accent} />
              <Text style={styles.addSlotCompactText}>Add</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          onPress={onPressAdd}
          disabled={addDisabled}
          style={({ pressed }) => [
            styles.addSlotLarge,
            addDisabled && styles.addSlotDisabled,
            pressed && !addDisabled && styles.addSlotPressed,
          ]}
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.accent} size="small" />
          ) : (
            <>
              <View style={styles.addIconCircle}>
                <Ionicons name="images-outline" size={26} color={COLORS.accent} />
              </View>
              <Text style={styles.addSlotLargeTitle}>{addLabel}</Text>
              <Text style={styles.addSlotLargeHint}>Optional · for your diary</Text>
            </>
          )}
        </Pressable>
      )}

      {hasPhotos && !uploading && !atMax ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPressAdd}
          disabled={addDisabled}
          style={styles.changeLinkWrap}
        >
          <Text style={styles.changeLinkText}>Add another photo</Text>
        </Pressable>
      ) : null}

      {showShareToggle ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: sharePublicly, disabled }}
          accessibilityLabel="Share approved photos to help others discover this workspace"
          disabled={disabled}
          onPress={() => onSharePubliclyChange?.(!sharePublicly)}
          style={({ pressed }) => [styles.shareRow, pressed && !disabled && styles.shareRowPressed]}
        >
          <View style={styles.shareCopy}>
            <Text style={styles.shareLabel}>
              Share approved photos to help others discover this workspace
            </Text>
            <Text style={styles.shareHelper}>
              If enabled, your photos may appear publicly after moderation. Otherwise they&apos;ll
              stay private in your workspace history.
            </Text>
          </View>
          <Switch
            value={sharePublicly}
            onValueChange={onSharePubliclyChange}
            disabled={disabled}
            trackColor={{
              false: 'rgba(92, 83, 72, 0.22)',
              true: 'rgba(0, 0, 0, 0.55)',
            }}
            thumbColor={Platform.OS === 'android' ? COLORS.background : undefined}
            ios_backgroundColor="rgba(92, 83, 72, 0.22)"
          />
        </Pressable>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}
    </View>
  );
}

const THUMB = 120;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    marginTop: -4,
  },
  strip: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 4,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.imagePlaceholder,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlotLarge: {
    minHeight: 132,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.accent,
    backgroundColor: COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
  },
  addSlotCompact: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addSlotDisabled: {
    opacity: 0.55,
  },
  addSlotPressed: {
    opacity: 0.88,
  },
  addIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  addSlotLargeTitle: {
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    textAlign: 'center',
  },
  addSlotLargeHint: {
    fontSize: 12,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    textAlign: 'center',
  },
  addSlotCompactText: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  changeLinkWrap: {
    alignSelf: 'flex-start',
    marginTop: -2,
  },
  changeLinkText: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
  },
  shareRowPressed: {
    opacity: 0.92,
  },
  shareCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  shareLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
  },
  shareHelper: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#8B4A4A',
    fontFamily: FONTS.sans.medium,
  },
  successText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4A5A49',
    fontFamily: FONTS.sans.medium,
  },
});
