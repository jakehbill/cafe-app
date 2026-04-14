import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
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

  const onDragBegin = useCallback((_index: number) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const onDragEnd = useCallback(
    async ({ data }: { data: Cafe[] }) => {
      setVisitedCafes(data);
      setReordering(true);
      try {
        await reorderVisitedCafes(data.map((c) => c.id));
      } finally {
        setReordering(false);
      }
    },
    [reorderVisitedCafes]
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

  const listHeader = (
    <>
      {backRow}
      <Text style={styles.screenTitle}>Visited</Text>
      <Text style={styles.hint}>Rank your visited cafes to improve recommendations</Text>
    </>
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<Cafe>) => {
      const index = getIndex() ?? 0;
      return (
        <ScaleDecorator>
          <View style={[styles.dragRow, isActive && styles.dragRowActive]}>
            <CompactCafeCard
              rank={index + 1}
              cafe={item}
              scorePosition="cardTopRight"
              reserveTagSpaceWhenEmpty
              onPress={() => router.push(`/cafe/${item.id}`)}
              trailing={
                <TouchableOpacity
                  accessibilityLabel="Drag to reorder"
                  accessibilityHint="Long press, then drag to change rank"
                  accessibilityRole="button"
                  delayLongPress={160}
                  onLongPress={drag}
                  disabled={isActive}
                  style={styles.dragHandle}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                  <Ionicons name="reorder-three-outline" size={22} color={COLORS.muted} />
                </TouchableOpacity>
              }
            />
          </View>
        </ScaleDecorator>
      );
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {visitedCafes.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Visited</Text>
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
        </ScrollView>
      ) : (
        <DraggableFlatList
          data={visitedCafes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragBegin={onDragBegin}
          onDragEnd={onDragEnd}
          containerStyle={styles.draggableContainer}
          contentContainerStyle={styles.draggableContent}
          ListHeaderComponent={listHeader}
          ListFooterComponent={
            reordering ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={COLORS.muted} />
                <Text style={styles.savingText}>Saving order…</Text>
              </View>
            ) : null
          }
          activationDistance={12}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  draggableContainer: {
    flex: 1,
  },
  draggableContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 0,
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
    marginBottom: 10,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  dragRow: {
    marginBottom: 14,
  },
  dragRowActive: {
    zIndex: 99,
    shadowColor: '#1a1a1a',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dragHandle: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    minHeight: 44,
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
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  savingText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
});
