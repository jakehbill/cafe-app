import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { COLORS, FONTS } from '@/components/theme';
import type { Cafe } from '@/data/cafes';
import { buildWorkspaceCardFactParts } from '@/lib/cafeWorkspaceSummary';

type Props = {
  cafe: Pick<Cafe, 'workspaceSummary'>;
  /** Dark hero overlay on homepage. */
  tone?: 'default' | 'onDark';
  style?: StyleProp<TextStyle>;
};

/**
 * Compact card line: typical work session · cost to work (skips empties).
 */
export function WorkspaceCardFacts({ cafe, tone = 'default', style }: Props) {
  const parts = buildWorkspaceCardFactParts(cafe);
  if (parts.length === 0) return null;

  return (
    <Text
      style={[styles.line, tone === 'onDark' && styles.lineOnDark, style]}
      numberOfLines={1}
    >
      {parts.map((part, index) => (
        <Text key={`${part}-${index}`}>
          {index > 0 ? <Text style={tone === 'onDark' ? styles.dotOnDark : styles.dot}> {'\u2022'} </Text> : null}
          {part}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    letterSpacing: -0.05,
  },
  lineOnDark: {
    color: 'rgba(250,248,245,0.82)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dot: {
    color: COLORS.muted,
    opacity: 0.7,
  },
  dotOnDark: {
    color: 'rgba(250,248,245,0.55)',
  },
});
