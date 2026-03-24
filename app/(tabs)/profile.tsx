import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useCafeState } from '@/contexts/CafeStateContext';
import {
  computeActivityPoints,
  computeProfileBadges,
  getLevelProgress,
  POINTS,
  type ActivityCounts,
} from '@/lib/profileGamification';

import { COLORS } from './components/theme';

type ProfileCounts = {
  saved: number;
  visited: number;
  ratings: number;
};

/**
 * Same tables / filters as `CafeStateContext.refreshUserCafeData`, but row counts only.
 * Uses `cafe_id` in select so PostgREST returns a reliable `count` with `head: true`.
 */
async function fetchProfileCountsFromSupabase(userId: string): Promise<ProfileCounts> {
  const [savedRes, visitedRes, ratingsRes] = await Promise.all([
    supabase
      .from('user_saved_cafes')
      .select('cafe_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('user_visited_cafes')
      .select('cafe_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('user_cafe_ratings')
      .select('cafe_id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if (savedRes.error) {
    console.error('Profile count saved:', savedRes.error);
  }
  if (visitedRes.error) {
    console.error('Profile count visited:', visitedRes.error);
  }
  if (ratingsRes.error) {
    console.error('Profile count ratings:', ratingsRes.error);
  }

  return {
    saved: savedRes.count ?? 0,
    visited: visitedRes.count ?? 0,
    ratings: ratingsRes.count ?? 0,
  };
}

function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { ratingsByCafeId } = useCafeState();
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

    const next = await fetchProfileCountsFromSupabase(userId);

    setCounts(next);
    setCountsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useFocusEffect(
    useCallback(() => {
      void loadCounts();
    }, [loadCounts])
  );

  const displayCounts = counts ?? { saved: 0, visited: 0, ratings: 0 };

  const activityCounts: ActivityCounts = useMemo(
    () => ({
      saved: displayCounts.saved,
      visited: displayCounts.visited,
      ratings: displayCounts.ratings,
    }),
    [displayCounts.saved, displayCounts.visited, displayCounts.ratings]
  );

  const totalPoints = useMemo(() => computeActivityPoints(activityCounts), [activityCounts]);
  const levelProgress = useMemo(() => getLevelProgress(totalPoints), [totalPoints]);
  const badges = useMemo(
    () => computeProfileBadges(activityCounts, ratingsByCafeId),
    [activityCounts, ratingsByCafeId]
  );

  async function handleLogOut() {
    try {
      const signOutResult = await supabase.auth.signOut();
      const { error } = signOutResult;
      if (error) {
        console.error('Log out failed (Supabase error):', error);
        Alert.alert('Log out failed', error.message);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
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
            <>
              <Text style={styles.email}>{email}</Text>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={{ marginTop: 4 }} />
              ) : (
                <Text style={styles.levelSubtitle}>{levelProgress.currentTitle}</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.emailMuted}>Not signed in</Text>
              {!countsLoading ? (
                <Text style={styles.levelSubtitle}>{levelProgress.currentTitle}</Text>
              ) : null}
            </>
          )}
        </View>

        {/* Points + level progress — counts feed badges below after activity */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsHeaderRow}>
            <Text style={styles.pointsLabel}>Total points</Text>
            {countsLoading ? (
              <ActivityIndicator color={COLORS.roastedBrown} />
            ) : (
              <Text style={styles.pointsBig}>{formatPoints(totalPoints)}</Text>
            )}
          </View>

          {!countsLoading ? (
            <>
              <View style={styles.progressMetaRow}>
                <Text style={styles.progressMetaText} numberOfLines={1}>
                  {levelProgress.isMaxLevel
                    ? 'You’ve reached the top level'
                    : `${levelProgress.currentTitle} → ${levelProgress.nextTitle}`}
                </Text>
                {!levelProgress.isMaxLevel && levelProgress.nextTierMinPoints !== null ? (
                  <Text style={styles.progressFraction}>
                    {formatPoints(totalPoints)} / {formatPoints(levelProgress.nextTierMinPoints)}
                  </Text>
                ) : null}
              </View>

              {!levelProgress.isMaxLevel ? (
                <>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { flex: Math.max(0.001, levelProgress.progress01) },
                      ]}
                    />
                    <View style={{ flex: Math.max(0.001, 1 - levelProgress.progress01) }} />
                  </View>
                  <Text style={styles.pointsToNext}>
                    {levelProgress.pointsToNext === 1
                      ? `1 point to ${levelProgress.nextTitle}`
                      : `${levelProgress.pointsToNext} points to ${levelProgress.nextTitle}`}
                  </Text>
                </>
              ) : (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { flex: 1 }]} />
                </View>
              )}

              <Text style={styles.pointsHint}>
                Earn points: {POINTS.perSaved} per save · {POINTS.perVisited} per visit ·{' '}
                {POINTS.perRating} per rating
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.activitySection}>
          <Text style={styles.sectionHeading}>Your activity</Text>
          <Text style={styles.activitySectionIntro}>
            Visited, ratings, and saved — tap a row to open the full list.
          </Text>

          <View style={styles.statsRow}>
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
          </View>

          <View style={styles.activityList}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.activityRow}
              onPress={() => router.push('/my-cafes')}
            >
              <View style={styles.activityTextWrap}>
                <Text style={styles.activityTitle}>Visited Cafes</Text>
                <Text style={styles.activityHint}>Rank favorites and places you&apos;ve been</Text>
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
          </View>
        </View>

        <Text style={[styles.sectionHeading, styles.achievementsHeading]}>Achievements</Text>
        <Text style={styles.badgesExplainer}>
          Unlocked badges appear first. The rest unlock as you save, visit, rate highly, and tag what
          you love.
        </Text>
        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View
              key={b.id}
              style={[styles.badgeCell, !b.unlocked && styles.badgeCellLocked]}
            >
              <Text style={[styles.badgeIcon, !b.unlocked && styles.badgeIconLocked]}>
                {b.icon}
              </Text>
              <Text
                style={[styles.badgeLabel, !b.unlocked && styles.badgeLabelLocked]}
                numberOfLines={2}
              >
                {b.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.leaderboardHint}>Leaderboards may come later — for now, this is your journey.</Text>

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
    gap: 6,
    marginBottom: 20,
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
  levelSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.roastedBrown,
    marginTop: 2,
  },
  emailMuted: {
    fontSize: 15,
    color: '#B5A89A',
    lineHeight: 22,
  },
  pointsCard: {
    backgroundColor: '#F2EBDD',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7DDCD',
    padding: 18,
    marginBottom: 24,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pointsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  pointsBig: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  progressMetaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  progressFraction: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E4D9C8',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.sage,
  },
  pointsToNext: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  pointsHint: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  activitySection: {
    marginBottom: 28,
  },
  activitySectionIntro: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 17,
    marginBottom: 14,
    marginTop: -4,
  },
  achievementsHeading: {
    marginTop: 4,
  },
  badgesExplainer: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 17,
    marginBottom: 12,
    marginTop: -4,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  badgeCell: {
    width: '30%',
    flexGrow: 1,
    minWidth: '28%',
    maxWidth: '32%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#F7F3EE',
    borderWidth: 1,
    borderColor: '#EDE3D5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  badgeCellLocked: {
    opacity: 0.45,
    backgroundColor: '#EFE8DC',
  },
  badgeIcon: {
    fontSize: 22,
    color: COLORS.roastedBrown,
  },
  badgeIconLocked: {
    color: COLORS.muted,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 13,
  },
  badgeLabelLocked: {
    color: COLORS.muted,
  },
  leaderboardHint: {
    fontSize: 11,
    color: '#B5A89A',
    fontStyle: 'italic',
    marginBottom: 24,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
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
    marginBottom: 0,
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
