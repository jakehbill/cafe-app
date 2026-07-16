import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import type { Cafe } from '@/data/cafes';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';

import { CafeCardGrid } from '@/components/layout/CafeCardGrid';
import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import { CompactCafeCard } from '@/components/CompactCafeCard';
import { COLORS, FONTS } from '@/components/theme';

type RatingRow = {
  cafe_id: string;
  coffee: number;
  tags: string[] | null;
};

type RatedItem = {
  cafe: Cafe;
  rating: RatingRow;
};

export default function MyRatingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [items, setItems] = useState<RatedItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadRatings = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('user_cafe_ratings')
      .select('cafe_id, coffee, tags')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('My Ratings load error:', error);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as RatingRow[];
    const ids = rows.map((r) => String(r.cafe_id));
    const catalog = await fetchCafesByIdsOrdered(ids);
    const byId = new Map(catalog.map((c) => [c.id, c]));

    const next: RatedItem[] = [];
    for (const row of rows) {
      const id = String(row.cafe_id);
      const cafe = byId.get(id);
      if (cafe) {
        next.push({ cafe, rating: row });
      }
    }

    setItems(next);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadRatings();
    }, [loadRatings])
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
      <DesktopWebPageContainer variant="list" style={styles.pageContainer}>
      {loading ? (
        <>
          <View style={styles.headerBlock}>
            {backRow}
            <Text style={styles.screenTitle}>Ratings</Text>
          </View>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.muted} />
          </View>
        </>
      ) : items.length === 0 ? (
        <>
          <View style={styles.headerBlock}>
            {backRow}
            <Text style={styles.screenTitle}>Ratings</Text>
          </View>
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No ratings yet</Text>
            <Text style={styles.emptySubtitle}>Rate spaces to keep track of where you&apos;ve worked</Text>
          </View>
        </>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {backRow}
          <Text style={styles.screenTitle}>Ratings</Text>
          <CafeCardGrid>
          {items.map(({ cafe, rating }) => (
            <CompactCafeCard
              key={rating.cafe_id}
              cafe={cafe}
              scorePosition="cardTopRight"
              reserveTagSpaceWhenEmpty
              tags={rating.tags ?? undefined}
              maxTags={3}
              onPress={() => router.push(`/cafe/${cafe.id}`)}
            />
          ))}
          </CafeCardGrid>
        </ScrollView>
      )}
      </DesktopWebPageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pageContainer: {
    flex: 1,
  },
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 4,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 64,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
    textAlign: 'center',
    fontFamily: FONTS.sans.regular,
  },
});
