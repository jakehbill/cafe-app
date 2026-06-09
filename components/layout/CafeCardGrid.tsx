import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useDesktopWebLayout } from '@/hooks/use-desktop-web-layout';
import { DESKTOP_CARD_MAX_WIDTH } from '@/lib/responsiveWebLayout';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Single-column café card stack on mobile; responsive 2–3 column grid on desktop web.
 */
export function CafeCardGrid({ children, style }: Props) {
  const { isDesktopWeb, gridColumns } = useDesktopWebLayout('list');
  const items = React.Children.toArray(children);

  if (!isDesktopWeb || gridColumns <= 1) {
    return <View style={[styles.stack, style]}>{items}</View>;
  }

  return (
    <View key={`cafe-card-grid-${gridColumns}`} style={[styles.grid, style]}>
      {items.map((child, index) => (
        <View
          key={index}
          style={[
            styles.gridItem,
            gridColumns >= 3 ? styles.gridItemThree : styles.gridItemTwo,
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  gridItem: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: DESKTOP_CARD_MAX_WIDTH,
  },
  gridItemTwo: {
    flexBasis: '48%',
    minWidth: 300,
  },
  gridItemThree: {
    flexBasis: '31%',
    minWidth: 280,
  },
});
