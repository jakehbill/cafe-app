import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Cafe } from '@/data/cafes';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';
import {
  deleteUserCafeVisit,
  getUserCafeVisitTimeline,
  setUserCafeVisitVisibility,
  type UserCafeVisit,
} from '@/lib/userCafeVisits';

import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { COLORS, FONTS } from '@/components/theme';

export default function MyCafesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [visitLogs, setVisitLogs] = useState<UserCafeVisit[]>([]);
  const [cafesById, setCafesById] = useState<Record<string, Cafe>>({});

  const load = useCallback(async () => {
    const logs = await getUserCafeVisitTimeline();
    const orderedCafeIds = Array.from(
      new Set(logs.map((row) => row.cafeId).filter((id): id is string => Boolean(id)))
    );
    const cafes = await fetchCafesByIdsOrdered(orderedCafeIds);
    const nextMap: Record<string, Cafe> = {};
    for (const cafe of cafes) nextMap[cafe.id] = cafe;
    setVisitLogs(logs);
    setCafesById(nextMap);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const logs = await getUserCafeVisitTimeline();
      const orderedCafeIds = Array.from(new Set(logs.map((row) => row.cafeId).filter(Boolean)));
      const cafes = await fetchCafesByIdsOrdered(orderedCafeIds as string[]);
      if (cancelled) return;
      const nextMap: Record<string, Cafe> = {};
      for (const cafe of cafes) nextMap[cafe.id] = cafe;
      setVisitLogs(logs);
      setCafesById(nextMap);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const backRow = (
    <View style={styles.backRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.backHit}
      >
        <Text style={styles.backIcon}>{"<"}</Text>
      </TouchableOpacity>
    </View>
  );

  const formatVisitDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  function handleDelete(visit: UserCafeVisit) {
    Alert.alert('Delete visit?', 'This entry will be removed from your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const res = await deleteUserCafeVisit(visit.id);
            if (!res.ok) {
              Alert.alert('Could not delete', res.error);
              return;
            }
            await load();
          })();
        },
      },
    ]);
  }

  function handleToggleVisibility(visit: UserCafeVisit) {
    const nextIsPublic = !visit.isPublic;
    const label = nextIsPublic ? 'Make public?' : 'Make private?';
    const message = nextIsPublic
      ? 'This will submit your visit photo for moderation if needed.'
      : 'This removes any unapproved photo from the public moderation pool.';
    Alert.alert(label, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          void (async () => {
            const res = await setUserCafeVisitVisibility(visit.id, nextIsPublic);
            if (!res.ok) {
              Alert.alert('Could not update', res.error);
              return;
            }
            await load();
          })();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {visitLogs.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Visit log</Text>
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>+</Text>
            </View>
            <Text style={styles.emptyTitle}>No visits logged yet</Text>
            <Text style={styles.subtitle}>Open a cafe and tap "Log your visit"</Text>
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
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Visit log</Text>
          <Text style={styles.hint}>Your timeline, newest first</Text>
          <View style={styles.timelineList}>
            {visitLogs.map((visit) => {
              const cafe = visit.cafeId ? cafesById[visit.cafeId] : undefined;
              return (
                <TouchableOpacity
                  key={visit.id}
                  activeOpacity={0.9}
                  style={styles.visitCard}
                  onPress={() => {
                    if (visit.cafeId) router.push(`/cafe/${visit.cafeId}`);
                  }}
                >
                  {visit.imageUrl ? (
                    <Image source={{ uri: visit.imageUrl }} style={styles.visitImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.visitImage, styles.visitImageFallback]} />
                  )}
                  <View style={styles.visitBody}>
                    <View style={styles.visitHeaderRow}>
                      <Text style={styles.visitCafeName} numberOfLines={1}>
                        {cafe?.name ?? visit.submissionCafeName ?? 'Cafe'}
                      </Text>
                      <Text style={styles.visitDate}>{formatVisitDate(visit.createdAt)}</Text>
                    </View>
                    <Text style={styles.visitMeta}>
                      {visit.rating != null ? `${visit.rating.toFixed(1)} / 5` : 'No rating'}
                    </Text>
                    {visit.tags.length > 0 ? (
                      <View style={styles.visitTagsRow}>
                        {visit.tags.slice(0, 3).map((tag) => (
                          <View key={`${visit.id}-${tag}`} style={styles.inlineTag}>
                            <TagWithOptionalIcon tag={tag} iconSize={12} textStyle={styles.inlineTagText} gap={4} />
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {visit.note.trim().length > 0 ? (
                      <Text style={styles.visitNote} numberOfLines={2}>
                        {visit.note}
                      </Text>
                    ) : null}
                    {visit.cafeId == null ? (
                      <View style={styles.statusRow}>
                        <Text
                          style={[
                            styles.pendingPill,
                            visit.submissionStatus === 'rejected' && styles.rejectedPill,
                          ]}
                        >
                          {visit.submissionStatus === 'rejected'
                            ? 'Suggestion rejected'
                            : visit.submissionStatus === 'approved'
                              ? 'Approved and syncing'
                              : 'Pending cafe approval'}
                        </Text>
                        <Text style={styles.statusHint} numberOfLines={2}>
                          {visit.submissionStatus === 'rejected'
                            ? 'Your visit stays in your log. You can quickly resubmit with clearer details.'
                            : 'Your visit is saved now and will auto-link once this cafe is approved.'}
                        </Text>
                      </View>
                    ) : null}
                    {visit.isPublic ? <Text style={styles.publicPill}>Shared publicly</Text> : null}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.actionChip}
                        onPress={() =>
                          router.push({
                            pathname: '/log-visit/[id]',
                            params: {
                              id: visit.cafeId ?? '',
                              visitId: visit.id,
                            },
                          })
                        }
                      >
                        <Text style={styles.actionChipText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.actionChip}
                        onPress={() => handleToggleVisibility(visit)}
                      >
                        <Text style={styles.actionChipText}>{visit.isPublic ? 'Make private' : 'Make public'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.actionChip, styles.actionChipDanger]}
                        onPress={() => handleDelete(visit)}
                      >
                        <Text style={styles.actionChipDangerText}>Delete</Text>
                      </TouchableOpacity>
                      {visit.submissionStatus === 'rejected' ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={styles.actionChip}
                          onPress={() =>
                            router.push({
                              pathname: '/suggest-cafe',
                              params: {
                                prefillName: cafe?.name ?? visit.submissionCafeName ?? '',
                                fromVisitLog: '1',
                                visitRating: visit.rating != null ? String(visit.rating) : '',
                                visitTags: visit.tags.join(','),
                                visitNote: visit.note,
                                visitIsPublic: visit.isPublic ? '1' : '0',
                              },
                            })
                          }
                        }
                        >
                          <Text style={styles.actionChipText}>Resubmit suggestion</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
  backIcon: {
    fontSize: 24,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
    lineHeight: 28,
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
  timelineList: {
    gap: 12,
    marginTop: 4,
  },
  visitCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    overflow: 'hidden',
  },
  visitImage: {
    width: '100%',
    height: 170,
    backgroundColor: COLORS.imagePlaceholder,
  },
  visitImageFallback: {
    backgroundColor: COLORS.imagePlaceholder,
  },
  visitBody: {
    padding: 12,
    gap: 7,
  },
  visitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  visitCafeName: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  visitDate: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: FONTS.sans.medium,
  },
  visitMeta: {
    fontSize: 13,
    color: COLORS.muted,
    fontFamily: FONTS.sans.medium,
  },
  visitTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  inlineTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineTagText: {
    fontSize: 11,
    color: COLORS.text,
    fontFamily: FONTS.sans.medium,
  },
  visitNote: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.text,
    fontFamily: FONTS.sans.regular,
  },
  publicPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
    backgroundColor: COLORS.accentSubtleFill,
  },
  pendingPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    backgroundColor: COLORS.inputBackground,
  },
  rejectedPill: {
    color: '#8B4A4A',
    backgroundColor: 'rgba(180, 80, 80, 0.08)',
  },
  statusRow: {
    gap: 6,
  },
  statusHint: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
  },
  actionsRow: {
    marginTop: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionChipText: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  actionChipDanger: {
    borderColor: 'rgba(180, 80, 80, 0.35)',
    backgroundColor: 'rgba(180, 80, 80, 0.08)',
  },
  actionChipDangerText: {
    fontSize: 12,
    color: '#8B4A4A',
    fontFamily: FONTS.sans.semibold,
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
});
