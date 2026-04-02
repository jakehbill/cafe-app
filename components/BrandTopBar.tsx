import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/components/theme';

/** Same asset and sizing as Home (`app/(tabs)/index.tsx`). */
const BEANED_LOGO = require('../assets/images/Beaned Logo .png');

export type BrandTopBarProps = {
  /** When false, only the notification bell is shown (Search tab). */
  showSearchIcon?: boolean;
};

export function BrandTopBar({ showSearchIcon = true }: BrandTopBarProps) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Image
        source={BEANED_LOGO}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logo: {
    height: 32,
    width: 135,
    marginLeft: -14,
    backgroundColor: 'transparent',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
