import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

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
};

/**
 * Personal visit photos on log/rate flows — separate from the public café listing image.
 */
export function VisitPhotosSection({
  photos,
  onPressAdd,
  onPressRemove,
  uploading = false,
  disabled = false,
  error,
  success,
  addLabel = 'Add photo from your visit',
  maxPhotos,
}: Props) {
  const hasPhotos = photos.length > 0;
  const addDisabled = disabled || uploading;
  const atMax = maxPhotos != null && photos.length >= maxPhotos;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your visit photos</Text>
      <Text style={styles.subtitle}>
        Personal memories from your visit. These stay separate from the café&apos;s public listing
        photo.
      </Text>

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
              <Text style={styles.addSlotLargeHint}>Optional · yours only</Text>
            </>
          )}
        </Pressable>
      )}

      {hasPhotos && !uploading ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPressAdd}
          disabled={addDisabled}
          style={styles.changeLinkWrap}
        >
          <Text style={styles.changeLinkText}>Add or change photo</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}
      <Text style={styles.moderationHint}>
        Photos are reviewed before they can appear on the public café page.
      </Text>
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
  moderationHint: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
});
