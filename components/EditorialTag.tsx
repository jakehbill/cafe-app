import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { COLORS, FONTS } from '@/components/theme';

export type EditorialTagVariant = 'featured' | 'secondary' | 'selectable';

type Props = {
  tag: string;
  variant?: EditorialTagVariant;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/**
 * Editorial label — border-forward “tasting note” chips, not grey SaaS pills.
 */
export function EditorialTag({
  tag,
  variant = 'featured',
  selected = false,
  onPress,
  style,
}: Props) {
  const isFeatured = variant === 'featured';
  const isSecondary = variant === 'secondary';
  const isSelectable = variant === 'selectable';

  const shellStyle = [
    styles.shell,
    isFeatured && styles.featured,
    isSecondary && styles.secondary,
    isSelectable && (selected ? styles.selectableSelected : styles.selectable),
    style,
  ];

  const iconSize = isSecondary ? 10 : isFeatured ? 12 : 12;
  const textStyle = [
    styles.label,
    isFeatured && styles.labelFeatured,
    isSecondary && styles.labelSecondary,
    isSelectable && (selected ? styles.labelSelectableSelected : styles.labelSelectable),
  ];

  const inner = (
    <View style={shellStyle}>
      <TagWithOptionalIcon
        tag={tag}
        iconSize={iconSize}
        color={COLORS.text}
        textStyle={textStyle}
        gap={5}
      />
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isSelectable ? selected : undefined }}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  featured: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
    backgroundColor: 'transparent',
  },
  secondary: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.tagSecondaryBorder,
    backgroundColor: 'transparent',
  },
  selectable: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.tagSecondaryBorder,
    backgroundColor: 'transparent',
  },
  selectableSelected: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.text,
    backgroundColor: COLORS.accentSubtleFill,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.sans.medium,
  },
  labelFeatured: {
    fontSize: 12,
    fontFamily: FONTS.sans.medium,
    letterSpacing: -0.1,
  },
  labelSecondary: {
    fontSize: 11,
    fontFamily: FONTS.sans.regular,
    letterSpacing: 0.05,
    opacity: 0.92,
  },
  labelSelectable: {
    fontSize: 12,
    fontFamily: FONTS.sans.medium,
  },
  labelSelectableSelected: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
  },
  pressed: {
    opacity: 0.88,
  },
});
