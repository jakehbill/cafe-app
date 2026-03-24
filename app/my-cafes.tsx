import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cafes } from '@/data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';

import { CompactCafeCard } from './(tabs)/components/CompactCafeCard';
import { COLORS } from './(tabs)/components/theme';

export default function MyCafesScreen() {
  const router = useRouter();
  const { visitedCafeIds, reorderVisitedCafes } = useCafeState();
  const [reordering, setReordering] = useState(false);

  const visitedCafes = visitedCafeIds
    .map((id) => cafes.find((c) => c.id === id))
    .filter((c): c is (typeof cafes)[number] => c != null);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
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
                <View key={cafe.id} style={styles.row}>
                  <View style={styles.cardWrap}>
                    <CompactCafeCard
                      rank={index + 1}
                      cafe={cafe}
                      onPress={() => router.push(`/cafe/${cafe.id}`)}
                    />
                  </View>
                  <View style={styles.reorderCol}>
                    <TouchableOpacity
                      accessibilityLabel="Move up"
                      disabled={reordering || index === 0}
                      style={[styles.reorderBtn, (reordering || index === 0) && styles.reorderBtnDisabled]}
                      onPress={() => void move(index, -1)}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={22}
                        color={reordering || index === 0 ? COLORS.muted : COLORS.roastedBrown}
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
                        size={22}
                        color={
                          reordering || index === visitedCafes.length - 1
                            ? COLORS.muted
                            : COLORS.roastedBrown
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            {reordering ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={COLORS.roastedBrown} />
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
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
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
    backgroundColor: '#F7F3EE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE3D5',
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
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
    backgroundColor: '#8A6A4F',
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 79, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ctaButtonText: {
    color: '#F7F3EE',
    fontSize: 13,
    fontWeight: '700',
  },
  listWrap: {
    gap: 10,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardWrap: {
    flex: 1,
    minWidth: 0,
  },
  reorderCol: {
    justifyContent: 'center',
    gap: 2,
  },
  reorderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 40,
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
