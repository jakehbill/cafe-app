import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

import { COLORS } from './components/theme';

type ProfileCounts = {
  saved: number;
  visited: number;
  ratings: number;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const email = user?.email ?? '';

  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setCounts({ saved: 0, visited: 0, ratings: 0 });
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    const [savedRes, visitedRes, ratingsRes] = await Promise.all([
      supabase
        .from('user_saved_cafes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('user_visited_cafes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('user_cafe_ratings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    if (savedRes.error) console.error('Profile count saved:', savedRes.error);
    if (visitedRes.error) console.error('Profile count visited:', visitedRes.error);
    if (ratingsRes.error) console.error('Profile count ratings:', ratingsRes.error);

    setCounts({
      saved: savedRes.count ?? 0,
      visited: visitedRes.count ?? 0,
      ratings: ratingsRes.count ?? 0,
    });
    setCountsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  async function handleLogOut() {
    console.log('LOG OUT pressed');

    try {
      const signOutResult = await supabase.auth.signOut();
      console.log('Supabase signOut response:', signOutResult);

      const { error } = signOutResult;
      if (error) {
        console.error('Log out failed (Supabase error):', error);
        Alert.alert('Log out failed', error.message);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Session after logout:', {
        sessionError,
        hasSession: !!sessionData.session,
      });

      if (sessionData.session) {
        console.error('Log out: session still present after signOut');
        Alert.alert('Log out failed', 'Session could not be cleared. Try again.');
        return;
      }

      router.replace('/auth');
    } catch (e) {
      console.error('Log out failed (unexpected):', e);
      Alert.alert(
        'Log out failed',
        e instanceof Error ? e.message : 'Something went wrong'
      );
    }
  }

  const displayCounts = counts ?? { saved: 0, visited: 0, ratings: 0 };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Profile</Text>
          {email ? (
            <Text style={styles.email}>{email}</Text>
          ) : (
            <Text style={styles.emailMuted}>Not signed in</Text>
          )}
        </View>

        <Text style={styles.sectionHeading}>Your stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            {countsLoading ? (
              <ActivityIndicator color={COLORS.roastedBrown} style={styles.statSpinner} />
            ) : (
              <Text style={styles.statNumber}>{displayCounts.saved}</Text>
            )}
            <Text style={styles.statLabel} numberOfLines={2}>
              Saved Cafes
            </Text>
          </View>
          <View style={styles.statCard}>
            {countsLoading ? (
              <ActivityIndicator color={COLORS.roastedBrown} style={styles.statSpinner} />
            ) : (
              <Text style={styles.statNumber}>{displayCounts.visited}</Text>
            )}
            <Text style={styles.statLabel} numberOfLines={2}>
              Visited Cafes
            </Text>
          </View>
          <View style={styles.statCard}>
            {countsLoading ? (
              <ActivityIndicator color={COLORS.roastedBrown} style={styles.statSpinner} />
            ) : (
              <Text style={styles.statNumber}>{displayCounts.ratings}</Text>
            )}
            <Text style={styles.statLabel} numberOfLines={2}>
              Ratings
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Your activity</Text>
        <View style={styles.activityList}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.activityRow}
            onPress={() => router.push('/saved')}
          >
            <View style={styles.activityTextWrap}>
              <Text style={styles.activityTitle}>Saved Cafes</Text>
              <Text style={styles.activityHint}>Bookmarks you have saved</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.activityRow}
            onPress={() => router.push('/my-cafes')}
          >
            <View style={styles.activityTextWrap}>
              <Text style={styles.activityTitle}>Visited Cafes</Text>
              <Text style={styles.activityHint}>Places you have marked visited</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.activityRow}
            onPress={() => router.push('/ratings')}
          >
            <View style={styles.activityTextWrap}>
              <Text style={styles.activityTitle}>Ratings</Text>
              <Text style={styles.activityHint}>Cafes you have rated</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logoutBlock}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.logOutButton}
            onPress={() => void handleLogOut()}
          >
            <Text style={styles.logOutButtonText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingTop: 20,
    paddingBottom: 36,
    gap: 0,
  },
  headerBlock: {
    gap: 8,
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  email: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
  },
  emailMuted: {
    fontSize: 15,
    color: '#B5A89A',
    lineHeight: 22,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F7F3EE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE3D5',
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    minHeight: 96,
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 14,
  },
  statSpinner: {
    marginVertical: 8,
  },
  activityList: {
    gap: 10,
    marginBottom: 40,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F2EBDD',
    borderWidth: 1,
    borderColor: '#E7DDCD',
    gap: 12,
  },
  activityTextWrap: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  activityHint: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.muted,
    lineHeight: 22,
  },
  logoutBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDE3D5',
  },
  logOutButton: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: '#F7F3EE',
    borderWidth: 1,
    borderColor: '#E0D4C4',
  },
  logOutButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
