import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/components/theme';
import { BeanedLogo } from '@/lib/brandAssets';

export type BrandTopBarProps = {
  /** When false, only the notification bell is shown (Search tab). */
  showSearchIcon?: boolean;
};

export function BrandTopBar({ showSearchIcon = true }: BrandTopBarProps) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <BeanedLogo
        width={194}
        height={46}
        style={styles.logo}
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
    height: 46,
    width: 194,
    marginLeft: -29,
    backgroundColor: 'transparent',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
