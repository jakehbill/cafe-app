import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
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

import { useAuth } from '@/contexts/AuthContext';
import { cafes, type Cafe } from '@/data/cafes';

import { CompactCafeCard } from '@/components/CompactCafeCard';
import { COLORS } from '@/components/theme';

type RatingRow = {
  cafe_id: string;
  coffee: number;
  work: number;
  vibe: number;
  tags: string[] | null;
};

type RatedItem = {
  cafe: Cafe;
  rating: RatingRow;
};

export default function MyRatingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<RatedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRatings = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('user_cafe_ratings')
      .select('cafe_id, coffee, work, vibe, tags')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('My Ratings load error:', error);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as RatingRow[];
    const byId = new Map(cafes.map((c) => [c.id, c]));

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.roastedBrown} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No ratings yet</Text>
          <Text style={styles.emptySubtitle}>Rate cafes to keep track of your experience</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {items.map(({ cafe, rating }) => (
            <CompactCafeCard
              key={rating.cafe_id}
              cafe={cafe}
              scores={{
                coffee: rating.coffee,
                work: rating.work,
                vibe: rating.vibe,
              }}
              tags={rating.tags ?? undefined}
              maxTags={3}
              onPress={() => router.push(`/cafe/${cafe.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 10,
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
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
