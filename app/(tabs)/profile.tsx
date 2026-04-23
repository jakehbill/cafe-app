import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useCafeState } from '@/contexts/CafeStateContext';
import { GamificationHelpModal } from '@/components/profile/GamificationHelpModal';
import {
  computeProfileBadges,
  computeSavedVisitedUnionCount,
  computeTotalPoints,
  countTagsInRatings,
  getLevelProgress,
  hasCafeSavedVisitedAndRated,
  POINTS,
  type ActivitySnapshot,
} from '@/lib/profileGamification';
import { getCurrentUserProfile, updateProfile, type UserProfile } from '@/lib/profile';
import { isModerator, logCurrentAuthUserId } from '@/lib/moderator';

import { COLORS, FONTS, SHADOWS } from '@/components/theme';

type ProfileCounts = {
  saved: number;
  visited: number;
  ratings: number;
  cafesSuggested: number;
  cafesApproved: number;
  photosSubmitted: number;
  photosApproved: number;
};

/**
 * Same tables / filters as `CafeStateContext.refreshUserCafeData`, but row counts only.
 * Uses `cafe_id` in select so PostgREST returns a reliable `count` with `head: true`.
 */
async function fetchProfileCountsFromSupabase(userId: string): Promise<ProfileCounts> {
  const [savedRes, visitedRes, ratingsRes, submissionRes, approvedSubmissionRes, photoRes, approvedPhotoRes, submissionPhotoRes] = await Promise.all([
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
    supabase
      .from('cafe_submissions')
      .select('cafe_name, area')
      .eq('user_id', userId),
    supabase
      .from('cafe_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'approved'),
    supabase
      .from('cafe_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('cafe_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'approved'),
    supabase
      .from('cafe_submission_photos')
      .select('id', { count: 'exact', head: true })
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
  if (submissionRes.error) {
    console.error('Profile count submissions:', submissionRes.error);
  }
  if (approvedSubmissionRes.error) {
    console.error('Profile count approved submissions:', approvedSubmissionRes.error);
  }
  if (photoRes.error) {
    console.error('Profile count photos:', photoRes.error);
  }
  if (approvedPhotoRes.error) {
    console.error('Profile count approved photos:', approvedPhotoRes.error);
  }
  if (submissionPhotoRes.error) {
    console.error('Profile count submission photos:', submissionPhotoRes.error);
  }

  // Anti-spam: award suggestion points once per meaningful cafe key for this user.
  const meaningfulSuggestionKeys = new Set(
    (submissionRes.data ?? []).map((row) => {
      const name = String(row.cafe_name ?? '').trim().toLowerCase();
      const area = String(row.area ?? '').trim().toLowerCase();
      return `${name}::${area}`;
    }).filter((key) => key !== '::')
  );

  return {
    saved: savedRes.count ?? 0,
    visited: visitedRes.count ?? 0,
    ratings: ratingsRes.count ?? 0,
    cafesSuggested: meaningfulSuggestionKeys.size,
    cafesApproved: approvedSubmissionRes.count ?? 0,
    photosSubmitted: (photoRes.count ?? 0) + (submissionPhotoRes.count ?? 0),
    photosApproved: approvedPhotoRes.count ?? 0,
  };
}

function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}

function emailLocalPart(email: string): string {
  const i = email.indexOf('@');
  return i > 0 ? email.slice(0, i) : email;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { ratingsByCafeId, savedCafeIds, visitedCafeIds } = useCafeState();
  const email = user?.email ?? '';

  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [profileRow, setProfileRow] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [showGamificationHelp, setShowGamificationHelp] = useState(false);

  const loadProfileRow = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setProfileRow(null);
      setDisplayNameDraft('');
      setEditingDisplayName(false);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const { data, error } = await getCurrentUserProfile();
    if (error) {
      console.warn('[Profile] getCurrentUserProfile', error);
      setProfileRow(null);
    } else {
      setProfileRow(data ?? null);
      setDisplayNameDraft(data?.display_name?.trim() ?? '');
    }
    setProfileLoading(false);
  }, [user?.id]);

  const loadCounts = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setCounts({
        saved: 0,
        visited: 0,
        ratings: 0,
        cafesSuggested: 0,
        cafesApproved: 0,
        photosSubmitted: 0,
        photosApproved: 0,
      });
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

  useEffect(() => {
    void loadProfileRow();
  }, [loadProfileRow]);

  useEffect(() => {
    if (!__DEV__) return;
    void logCurrentAuthUserId();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCounts();
      void loadProfileRow();
    }, [loadCounts, loadProfileRow])
  );

  const displayCounts = counts ?? {
    saved: 0,
    visited: 0,
    ratings: 0,
    cafesSuggested: 0,
    cafesApproved: 0,
    photosSubmitted: 0,
    photosApproved: 0,
  };

  const activitySnapshot: ActivitySnapshot = useMemo(() => {
    const tagCount = countTagsInRatings(ratingsByCafeId);
    return {
      savedCount: displayCounts.saved,
      visitedCount: displayCounts.visited,
      ratingsCount: displayCounts.ratings,
      tagCount,
      savedVisitedUnionCount: computeSavedVisitedUnionCount(savedCafeIds, visitedCafeIds),
      hasTripleEngagementCafe: hasCafeSavedVisitedAndRated(
        savedCafeIds,
        visitedCafeIds,
        ratingsByCafeId
      ),
      cafesSuggestedCount: displayCounts.cafesSuggested,
      cafesApprovedCount: displayCounts.cafesApproved,
      photosSubmittedCount: displayCounts.photosSubmitted,
      photosApprovedCount: displayCounts.photosApproved,
    };
  }, [
    displayCounts.saved,
    displayCounts.visited,
    displayCounts.ratings,
    displayCounts.cafesSuggested,
    displayCounts.cafesApproved,
    displayCounts.photosSubmitted,
    displayCounts.photosApproved,
    ratingsByCafeId,
    savedCafeIds,
    visitedCafeIds,
  ]);

  const totalPoints = useMemo(() => computeTotalPoints(activitySnapshot), [activitySnapshot]);
  const levelProgress = useMemo(() => getLevelProgress(totalPoints), [totalPoints]);
  const badges = useMemo(() => computeProfileBadges(activitySnapshot), [activitySnapshot]);
  const canAccessModeration = useMemo(() => isModerator(user?.id), [user?.id]);
  const gamificationHelpLines = useMemo(
    () => [
      { label: 'Rate a cafe', points: POINTS.perRating },
      { label: 'Visit a cafe', points: POINTS.perVisited },
      { label: 'Save a cafe', points: POINTS.perSaved },
      { label: 'Add a tag', points: POINTS.perTag },
      { label: 'Suggest a cafe', points: POINTS.perCafeSuggestion },
      { label: 'Approved cafe', points: POINTS.perCafeApproved },
      { label: 'Submit a photo', points: POINTS.perPhotoSubmitted },
      { label: 'Approved photo', points: POINTS.perPhotoApproved },
    ],
    []
  );

  const headlineName = useMemo(() => {
    const fromProfile = profileRow?.display_name?.trim();
    if (fromProfile) return fromProfile;
    if (email) return emailLocalPart(email);
    return 'Your account';
  }, [profileRow?.display_name, email]);

  function beginEditDisplayName() {
    setDisplayNameDraft(profileRow?.display_name?.trim() ?? '');
    setEditingDisplayName(true);
  }

  function cancelEditDisplayName() {
    Keyboard.dismiss();
    setDisplayNameDraft(profileRow?.display_name?.trim() ?? '');
    setEditingDisplayName(false);
  }

  async function handleSaveDisplayName() {
    const trimmed = displayNameDraft.trim();
    const current = profileRow?.display_name?.trim() ?? '';
    if (trimmed === current) {
      Keyboard.dismiss();
      setEditingDisplayName(false);
      return;
    }
    setSavingDisplayName(true);
    try {
      const res = await updateProfile({ display_name: trimmed || null });
      if (!res.ok) {
        Alert.alert('Could not save', res.error);
        return;
      }
      await loadProfileRow();
      Keyboard.dismiss();
      setEditingDisplayName(false);
    } finally {
      setSavingDisplayName(false);
    }
  }

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

      router.replace('/onboarding');
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
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Profile</Text>
          {email ? (
            <>
              {editingDisplayName ? (
                <View style={styles.displayNameEditRow}>
                  <TextInput
                    style={styles.displayNameInput}
                    value={displayNameDraft}
                    onChangeText={setDisplayNameDraft}
                    placeholder="Display name"
                    placeholderTextColor={COLORS.muted}
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={80}
                    editable={!savingDisplayName}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => void handleSaveDisplayName()}
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Save display name"
                    style={styles.inlineIconButton}
                    disabled={savingDisplayName}
                    onPress={() => void handleSaveDisplayName()}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    {savingDisplayName ? (
                      <ActivityIndicator color={COLORS.accent} size="small" />
                    ) : (
                      <Ionicons name="checkmark-circle" size={26} color={COLORS.accent} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing display name"
                    style={styles.inlineIconButton}
                    disabled={savingDisplayName}
                    onPress={cancelEditDisplayName}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Ionicons name="close-circle" size={26} color={COLORS.muted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.displayNameRow}>
                  <Text style={styles.displayNameHeadline} numberOfLines={2}>
                    {profileLoading ? '…' : headlineName}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Edit display name"
                    style={styles.inlineIconButton}
                    onPress={beginEditDisplayName}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={22} color={COLORS.muted} />
                  </TouchableOpacity>
                </View>
              )}
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

        {/* Points + progress toward next level (same model as achievements) */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsHeaderRow}>
            <Text style={styles.pointsLabel}>Total points</Text>
            {countsLoading ? (
              <ActivityIndicator color={COLORS.muted} />
            ) : (
              <Text style={styles.pointsBig}>{formatPoints(totalPoints)}</Text>
            )}
          </View>
          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="How to earn points"
            onPress={() => setShowGamificationHelp(true)}
            style={styles.pointsHelpButton}
          >
            <Ionicons name="information-circle-outline" size={16} color={COLORS.accent} />
            <Text style={styles.pointsHelpButtonText}>How to earn points</Text>
          </TouchableOpacity>

          {!countsLoading ? (
            <>
              <View style={styles.progressMetaRow}>
                <Text style={styles.progressMetaText} numberOfLines={2}>
                  {levelProgress.isMaxLevel
                    ? 'You’ve reached Cult Favourite — the top level.'
                    : `Progress toward ${levelProgress.nextTitle}`}
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
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
              ) : (
                <Text style={styles.statNumber}>{displayCounts.visited}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                Visited Cafes
              </Text>
            </View>
            <View style={styles.statCard}>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
              ) : (
                <Text style={styles.statNumber}>{displayCounts.ratings}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                Ratings
              </Text>
            </View>
            <View style={styles.statCard}>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
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
              onPress={() => router.navigate('/bookmarks')}
            >
              <View style={styles.activityTextWrap}>
                <Text style={styles.activityTitle}>Saved Cafes</Text>
                <Text style={styles.activityHint}>Bookmarks you have saved</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contributionSection}>
          <Text style={styles.sectionHeading}>Contribute</Text>
          <Text style={styles.activitySectionIntro}>
            Know a great spot we should review? Send it in and we&apos;ll curate from there.
          </Text>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.activityRow}
            onPress={() => router.push('/suggest-cafe')}
          >
            <View style={styles.activityTextWrap}>
              <Text style={styles.activityTitle}>Suggest a cafe</Text>
              <Text style={styles.activityHint}>Share a recommendation for editorial review</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
              ) : (
                <Text style={styles.statNumber}>{displayCounts.cafesSuggested}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                Cafes Suggested
              </Text>
            </View>
            <View style={styles.statCard}>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
              ) : (
                <Text style={styles.statNumber}>{displayCounts.cafesApproved}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                Cafes Approved
              </Text>
            </View>
            <View style={styles.statCard}>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
              ) : (
                <Text style={styles.statNumber}>{displayCounts.cafesApproved}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                Cafes Approved
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
              ) : (
                <Text style={styles.statNumber}>{displayCounts.photosSubmitted}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                Photos Submitted
              </Text>
            </View>
            <View style={styles.statCard}>
              {countsLoading ? (
                <ActivityIndicator color={COLORS.muted} style={styles.statSpinner} />
              ) : (
                <Text style={styles.statNumber}>{displayCounts.photosApproved}</Text>
              )}
              <Text style={styles.statLabel} numberOfLines={2}>
                Photos Approved
              </Text>
            </View>
          </View>
          <Text style={styles.activitySectionIntro}>
            Credibility: {displayCounts.cafesApproved + displayCounts.photosApproved >= 8
              ? 'Trusted contributor'
              : displayCounts.cafesApproved + displayCounts.photosApproved >= 3
                ? 'Growing contributor'
                : 'New contributor'}
          </Text>
          {canAccessModeration ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.activityRow}
              onPress={() => router.push('/moderation')}
            >
              <View style={styles.activityTextWrap}>
                <Text style={styles.activityTitle}>Moderation</Text>
                <Text style={styles.activityHint}>Internal review queue and tools</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.sectionHeading, styles.achievementsHeading]}>Achievements</Text>
        <Text style={styles.badgesExplainer}>
          Milestones along your points journey. Unlocked badges appear first.
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
              <View style={styles.badgeTextBlock}>
                <Text
                  style={[styles.badgeLabel, !b.unlocked && styles.badgeLabelLocked]}
                  numberOfLines={2}
                >
                  {b.label}
                </Text>
                <Text
                  style={[styles.badgeDescription, !b.unlocked && styles.badgeDescriptionLocked]}
                >
                  {b.description}
                </Text>
              </View>
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
      <GamificationHelpModal
        visible={showGamificationHelp}
        onClose={() => setShowGamificationHelp(false)}
        lines={gamificationHelpLines}
      />
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
    paddingTop: 24,
    paddingBottom: 40,
    gap: 0,
  },
  headerBlock: {
    gap: 8,
    marginBottom: 22,
  },
  displayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingRight: 4,
  },
  displayNameHeadline: {
    flex: 1,
    fontSize: 26,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  displayNameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingRight: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    paddingBottom: 6,
  },
  displayNameInput: {
    flex: 1,
    fontSize: 26,
    fontFamily: FONTS.display.semibold,
    color: COLORS.text,
    letterSpacing: -0.4,
    lineHeight: 32,
    paddingVertical: 2,
    paddingHorizontal: 0,
    margin: 0,
  },
  inlineIconButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  email: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
  },
  levelSubtitle: {
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
    marginTop: 2,
  },
  emailMuted: {
    fontSize: 15,
    color: '#B5A89A',
    lineHeight: 22,
  },
  pointsCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 18,
    marginBottom: 24,
    gap: 10,
    ...SHADOWS.card,
  },
  pointsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsLabel: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  pointsBig: {
    fontSize: 28,
    fontFamily: FONTS.sans.bold,
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
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  progressFraction: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.inputBackground,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  pointsToNext: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  pointsHelpButton: {
    marginTop: -1,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 2,
  },
  pointsHelpButtonText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.accent,
    fontFamily: FONTS.sans.semibold,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: FONTS.sans.bold,
    color: COLORS.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  activitySection: {
    marginBottom: 28,
  },
  contributionSection: {
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
    minHeight: 112,
    borderRadius: 14,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 8,
    paddingTop: 10,
    gap: 6,
  },
  badgeTextBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
  },
  badgeCellLocked: {
    opacity: 0.45,
    backgroundColor: '#EFE8DC',
  },
  badgeIcon: {
    fontSize: 22,
    color: COLORS.accent,
  },
  badgeIconLocked: {
    color: COLORS.muted,
  },
  badgeLabel: {
    fontSize: 10,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 13,
  },
  badgeLabelLocked: {
    color: COLORS.muted,
  },
  badgeDescription: {
    fontSize: 9,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 12,
  },
  badgeDescriptionLocked: {
    color: COLORS.muted,
    opacity: 0.85,
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
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
    ...SHADOWS.card,
    minHeight: 96,
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontFamily: FONTS.sans.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
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
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 12,
  },
  activityTextWrap: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 17,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  activityHint: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
    fontFamily: FONTS.sans.regular,
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
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  logOutButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
});
