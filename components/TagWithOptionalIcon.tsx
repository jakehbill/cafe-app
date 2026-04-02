import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

import { formatTagLabel } from '@/lib/cafeTags';
import { getTagIconName } from '@/lib/tagIcons';

type Props = {
  tag: string;
  iconSize?: number;
  color: string;
  textStyle: TextStyle | TextStyle[] | (TextStyle | undefined | false)[];
  /** Space between icon and label when an icon is shown */
  gap?: number;
};

/**
 * Single tag line: optional leading Ionicons glyph + label.
 * When `getTagIconName` returns null, only the label is rendered (plain chip).
 */
export function TagWithOptionalIcon({
  tag,
  iconSize = 14,
  color,
  textStyle,
  gap = 5,
}: Props) {
  const icon = getTagIconName(tag);
  if (!icon) {
    return <Text style={textStyle}>{formatTagLabel(tag)}</Text>;
  }
  return (
    <View style={[styles.row, { gap }]}>
      <Ionicons name={icon} size={iconSize} color={color} />
      <Text style={textStyle}>{formatTagLabel(tag)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
