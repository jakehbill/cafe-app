import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '@/components/theme';
import { useDesktopWeb } from '@/hooks/use-desktop-web';
import { DESKTOP_APP_MAX_WIDTH } from '@/lib/responsiveWebLayout';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override default app max width (desktop web only). */
  maxWidth?: number;
};

/**
 * Centers app content in a phone-width column on desktop web.
 * No-op on native iOS/Android and narrow mobile web viewports.
 */
export function WebMaxWidthContainer({ children, style, maxWidth = DESKTOP_APP_MAX_WIDTH }: Props) {
  const { isDesktopWeb } = useDesktopWeb();

  if (!isDesktopWeb) {
    return <View style={[styles.fill, style]}>{children}</View>;
  }

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
