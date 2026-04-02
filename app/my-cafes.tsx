import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Cafe } from '@/data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';

import { CompactCafeCard } from '@/components/CompactCafeCard';
import { COLORS, FONTS } from '@/components/theme';

export default function MyCafesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { visitedCafeIds, reorderVisitedCafes } = useCafeState();
  const [reordering, setReordering] = useState(false);
  const [visitedCafes, setVisitedCafes] = useState<Cafe[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchCafesByIdsOrdered(visitedCafeIds);
      if (__DEV__) {
        console.log('[DEBUG MyCafes visited]', {
          visitedIdCount: visitedCafeIds.length,
          resolvedCafeCount: list.length,
        });
      }
      if (!cancelled) setVisitedCafes(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [visitedCafeIds]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/profile');
    }
  }, [navigation, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const move = useCallback(
    async (fromIndex: number, direction: -1 | 1) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= visitedCafeIds.length) return;
      const next = [...visitedCafeIds];
      const t = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = t;
      setReordering(true);
      try {
        await reorderVisitedCafes(next);
      } finally {
        setReordering(false);
      }
    },
    [visitedCafeIds, reorderVisitedCafes]
  );

  const backRow = (
    <View style={styles.backRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.backHit}
      >
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {backRow}
        <Text style={styles.screenTitle}>Visited</Text>
        {visitedCafes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>✓</Text>
            </View>
            <Text style={styles.emptyTitle}>You haven&apos;t visited any cafes yet</Text>
            <Text style={styles.subtitle}>Mark cafes as visited to keep track</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.ctaButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.ctaButtonText}>Explore cafes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>Rank your visited cafes to improve recommendations</Text>
            <View style={styles.listWrap}>
              {visitedCafes.map((cafe, index) => (
                <CompactCafeCard
                  key={cafe.id}
                  rank={index + 1}
                  cafe={cafe}
                  showTagsUI={false}
                  onPress={() => router.push(`/cafe/${cafe.id}`)}
                  trailing={
                    <View style={styles.reorderCol}>
                      <TouchableOpacity
                        accessibilityLabel="Move up"
                        disabled={reordering || index === 0}
                        style={[
                          styles.reorderBtn,
                          (reordering || index === 0) && styles.reorderBtnDisabled,
                        ]}
                        onPress={() => void move(index, -1)}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={18}
                          color={reordering || index === 0 ? COLORS.muted : COLORS.accent}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel="Move down"
                        disabled={reordering || index === visitedCafes.length - 1}
                        style={[
                          styles.reorderBtn,
                          (reordering || index === visitedCafes.length - 1) && styles.reorderBtnDisabled,
                        ]}
                        onPress={() => void move(index, 1)}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={
                            reordering || index === visitedCafes.length - 1
                              ? COLORS.muted
                              : COLORS.accent
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  }
                />
              ))}
            </View>
            {reordering ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={COLORS.muted} />
                <Text style={styles.savingText}>Saving order…</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 12,
  },
  backRow: {
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  backHit: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontWeight: '500',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  emptyWrap: {
    marginTop: 20,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 10,
    alignItems: 'center',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(163, 177, 138, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.45)',
  },
  emptyIcon: {
    fontSize: 20,
    color: '#5B6E58',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 26, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  listWrap: {
    gap: 10,
    paddingBottom: 8,
  },
  reorderCol: {
    justifyContent: 'center',
    gap: 0,
    minWidth: 32,
  },
  reorderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.45,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  savingText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
});
