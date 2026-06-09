import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '@/components/theme';
import { useDesktopWeb } from '@/hooks/use-desktop-web';
import {
  getDesktopPageMaxWidth,
  type DesktopPageVariant,
} from '@/lib/responsiveWebLayout';

type Props = {
  children: React.ReactNode;
  /** list = browsing screens, form = focused flows, detail = café detail */
  variant?: DesktopPageVariant;
  style?: StyleProp<ViewStyle>;
};

/**
 * Centers page content with a variant-specific max width on desktop web only.
 * No-op on native iOS/Android and narrow mobile web viewports.
 */
export function DesktopWebPageContainer({
  children,
  variant = 'list',
  style,
}: Props) {
  const { isDesktopWeb } = useDesktopWeb();

  if (!isDesktopWeb) {
    return <View style={[styles.fill, style]}>{children}</View>;
  }

  const maxWidth = getDesktopPageMaxWidth(variant);

  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.column, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shell: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  column: {
    flex: 1,
    width: '100%',
  },
});
