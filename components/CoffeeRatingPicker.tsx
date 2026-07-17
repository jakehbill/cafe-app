import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

import { COLORS, FONTS } from '@/components/theme';
import {
  COFFEE_RATING_MAX,
  COFFEE_RATING_MIN,
  COFFEE_RATING_STEP,
  quantizeCoffeeRatingForStorage,
} from '@/lib/coffeeRating';

/** Visual resting position before the user sets a score (does not count as rated). */
const SLIDER_UNSET_POSITION = 7;

export type CoffeeRatingPickerProps = {
  value: number | null;
  onChange: (rating: number) => void;
  onClear?: () => void;
  title?: string;
  helperText?: string | null;
  showClear?: boolean;
  disabled?: boolean;
};

export function CoffeeRatingPicker({
  value,
  onChange,
  onClear,
  title = 'Work Score',
  helperText = 'How good was this place to work from?',
  showClear = false,
  disabled = false,
}: CoffeeRatingPickerProps) {
  const selected =
    value != null && Number.isFinite(value) ? quantizeCoffeeRatingForStorage(value) : null;
  const [sliderWidth, setSliderWidth] = useState(0);

  const sliderValue = selected ?? SLIDER_UNSET_POSITION;

  const a11yValue = useMemo(
    () =>
      selected != null
        ? `${selected} out of ${COFFEE_RATING_MAX}`
        : `Not set. Drag to choose a score from ${COFFEE_RATING_MIN} to ${COFFEE_RATING_MAX}`,
    [selected]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <View style={styles.sliderBlock}>
        <View style={styles.valueRow}>
          <Text
            accessibilityRole="text"
            accessibilityLabel={a11yValue}
            style={[styles.value, selected == null && styles.valueUnset]}
          >
            {selected != null ? String(selected) : '—'}
          </Text>
          <Text style={styles.valueScale}>/ {COFFEE_RATING_MAX}</Text>
        </View>

        <View
          style={styles.sliderHit}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setSliderWidth((prev) => (prev === w ? prev : w));
          }}
        >
          <Slider
            style={[styles.slider, sliderWidth > 0 ? { width: sliderWidth } : null]}
            minimumValue={COFFEE_RATING_MIN}
            maximumValue={COFFEE_RATING_MAX}
            step={COFFEE_RATING_STEP}
            value={sliderValue}
            disabled={disabled}
            onValueChange={(next) => {
              if (disabled) return;
              onChange(quantizeCoffeeRatingForStorage(next));
            }}
            minimumTrackTintColor={COLORS.accent}
            maximumTrackTintColor={COLORS.cardBorder}
            thumbTintColor={COLORS.accent}
            accessibilityLabel="Work Score"
            accessibilityValue={{
              min: COFFEE_RATING_MIN,
              max: COFFEE_RATING_MAX,
              now: selected ?? undefined,
              text: a11yValue,
            }}
            {...(Platform.OS === 'ios' ? { tapToSeek: true } : null)}
          />
        </View>

        <View style={styles.endsRow} pointerEvents="none">
          <Text style={styles.endLabel}>{COFFEE_RATING_MIN}</Text>
          <Text style={styles.endLabel}>{COFFEE_RATING_MAX}</Text>
        </View>
      </View>

      {showClear && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear rating"
          disabled={disabled || selected == null}
          onPress={onClear}
          style={styles.clearHit}
        >
          <Text style={[styles.clearText, (disabled || selected == null) && styles.clearTextMuted]}>
            Clear rating
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    marginTop: -4,
  },
  sliderBlock: {
    gap: 6,
    marginTop: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: FONTS.sans.bold,
    color: COLORS.text,
    letterSpacing: -0.6,
    minWidth: 36,
  },
  valueUnset: {
    color: COLORS.muted,
    opacity: 0.55,
  },
  valueScale: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
  },
  sliderHit: {
    width: '100%',
    justifyContent: 'center',
    // Larger vertical hit target for comfortable mobile dragging
    paddingVertical: Platform.OS === 'web' ? 8 : 12,
    marginVertical: -4,
  },
  slider: {
    width: '100%',
    height: Platform.OS === 'ios' ? 40 : 44,
  },
  endsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
    paddingHorizontal: 2,
  },
  endLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
    opacity: 0.85,
  },
  clearHit: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 13,
    fontFamily: FONTS.sans.medium,
    color: COLORS.roastedBrown,
  },
  clearTextMuted: {
    color: COLORS.muted,
    opacity: 0.6,
  },
});
