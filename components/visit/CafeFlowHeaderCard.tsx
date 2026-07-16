import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';

type Props = {
  name: string;
  subtitle: string;
  imageUri?: string;
};

/**
 * Compact café identity on log/rate flows — public listing photo only (never visit uploads).
 */
export function CafeFlowHeaderCard({ name, subtitle, imageUri }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Space on Beaned</Text>
      <View style={styles.row}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: COLORS.imagePlaceholder,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.imagePlaceholder,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
  },
});
