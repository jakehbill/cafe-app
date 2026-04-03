import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/components/theme';
import { BeanedLogo } from '@/lib/brandAssets';

/**
 * Rendered logo size (~12% larger than prior 168×38). Wordmark is vector/PNG, not live text.
 * `Beaned Logo .svg` viewBox width 1424.25; wordmark group begins at x ≈ 384 so the left edge of
 * "beaned." aligns with the screen grid when we shift the whole asset left by that ratio.
 */
const LOGO_VIEWBOX_W = 1424.25;
const LOGO_WORDMARK_X = 384;
const LOGO_WIDTH = 188;
const LOGO_HEIGHT = 43;
const LOGO_TEXT_ALIGN_SHIFT = Math.round(LOGO_WIDTH * (LOGO_WORDMARK_X / LOGO_VIEWBOX_W));

export type BrandTopBarProps = {
  /** When false, only the notification bell is shown (Search tab). */
  showSearchIcon?: boolean;
};

export function BrandTopBar({ showSearchIcon = true }: BrandTopBarProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.logoLockup}>
        <BeanedLogo
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          style={[styles.logo, { marginLeft: -LOGO_TEXT_ALIGN_SHIFT }]}
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.actions}>
        {showSearchIcon ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push('/search')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Ionicons name="search-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.75}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    height: 56,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /**
   * Single branded asset (icon + wordmark inside SVG/PNG). `gap` applies if the lockup is split later.
   * ~6px between icon and wordmark when using separate views.
   */
  logoLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    height: LOGO_HEIGHT,
    flexShrink: 1,
    overflow: 'visible',
  },
  logo: {
    backgroundColor: 'transparent',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    flexShrink: 0,
    height: LOGO_HEIGHT,
  },
});
