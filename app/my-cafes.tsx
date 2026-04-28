import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';
import {
  deleteUserCafeVisit,
  getUserCafeVisitTimeline,
  type UserCafeVisit,
} from '@/lib/userCafeVisits';

import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { COLORS, FONTS } from '@/components/theme';

export default function MyCafesScreen() {
  const router = useRouter();
  const { movedFromSaved } = useLocalSearchParams<{ movedFromSaved?: string | string[] }>();
  const navigation = useNavigation();
  const [visitLogs, setVisitLogs] = useState<UserCafeVisit[]>([]);
  const [cafesById, setCafesById] = useState<Record<string, Cafe>>({});
  const [showMovedToast, setShowMovedToast] = useState(false);

  useEffect(() => {
    const movedValue = Array.isArray(movedFromSaved) ? movedFromSaved[0] : movedFromSaved;
    if (movedValue === '1') {
      setShowMovedToast(true);
      const timeout = setTimeout(() => setShowMovedToast(false), 2300);
      return () => clearTimeout(timeout);
    }
    setShowMovedToast(false);
    return undefined;
  }, [movedFromSaved]);

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
      <StackHeaderBackButton canGoBack tintColor={COLORS.text} onPress={handleBack} />
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {visitLogs.length === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Your cafe diary</Text>
          <Text style={styles.hint}>A record of the cafes you’ve visited, rated and remembered.</Text>
          {showMovedToast ? (
            <View style={styles.toastBanner}>
              <Text style={styles.toastBannerText}>Moved to your visits</Text>
            </View>
          ) : null}
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>+</Text>
            </View>
            <Text style={styles.emptyTitle}>No visits logged yet</Text>
            <Text style={styles.subtitle}>
              When you visit a cafe, save a few notes here so you can remember where you&apos;ve been.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.ctaButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.ctaButtonText}>Find a cafe</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Your cafe diary</Text>
          {showMovedToast ? (
            <View style={styles.toastBanner}>
              <Text style={styles.toastBannerText}>Moved to your visits</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>A record of the cafes you’ve visited, rated and remembered.</Text>
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
                      <Text style={styles.visitDate}>Visited {formatVisitDate(visit.createdAt)}</Text>
                    </View>
                    {visit.rating != null ? (
                      <Text style={styles.visitMeta}>Rating {visit.rating.toFixed(1)} / 5</Text>
                    ) : null}
                    {visit.tags.length > 0 ? (
                      <View style={styles.diarySectionBlock}>
                        <Text style={styles.diarySectionLabel}>What stood out</Text>
                        <View style={styles.visitTagsRow}>
                          {visit.tags.slice(0, 3).map((tag) => (
                            <View key={`${visit.id}-${tag}`} style={styles.inlineTag}>
                              <TagWithOptionalIcon tag={tag} iconSize={12} textStyle={styles.inlineTagText} gap={4} />
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {visit.note.trim().length > 0 ? (
                      <View style={styles.diarySectionBlock}>
                        <Text style={styles.diarySectionLabel}>Your note</Text>
                        <Text style={styles.visitNote} numberOfLines={2}>
                          {visit.note}
                        </Text>
                      </View>
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
                              },
                            })
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
  toastBanner: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.55)',
    backgroundColor: 'rgba(163, 177, 138, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  toastBannerText: {
    color: '#5B6E58',
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
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
  diarySectionBlock: {
    gap: 5,
  },
  diarySectionLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontFamily: FONTS.sans.semibold,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
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
