import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompactCafeCard } from '@/components/CompactCafeCard';
import type { Cafe } from '@/data/cafes';
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';
import {
  getUserCafeVisitTimeline,
  type UserCafeVisit,
} from '@/lib/userCafeVisits';

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

  const latestVisitByCafe = React.useMemo(() => {
    const grouped = new Map<string, UserCafeVisit>();
    for (const visit of visitLogs) {
      if (!visit.cafeId) continue;
      const existing = grouped.get(visit.cafeId);
      if (!existing) {
        grouped.set(visit.cafeId, visit);
        continue;
      }
      const existingTime = Date.parse(existing.createdAt);
      const nextTime = Date.parse(visit.createdAt);
      if (!Number.isNaN(nextTime) && (Number.isNaN(existingTime) || nextTime > existingTime)) {
        grouped.set(visit.cafeId, visit);
      }
    }
    return Array.from(grouped.entries())
      .map(([cafeId, visit]) => ({ cafeId, visit, cafe: cafesById[cafeId] }))
      .filter((row): row is { cafeId: string; visit: UserCafeVisit; cafe: Cafe } => Boolean(row.cafe))
      .sort((a, b) => {
        const aTime = Date.parse(a.visit.createdAt);
        const bTime = Date.parse(b.visit.createdAt);
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return bTime - aTime;
      });
  }, [visitLogs, cafesById]);

  const pendingVisits = React.useMemo(
    () => visitLogs.filter((visit) => !visit.cafeId),
    [visitLogs]
  );

  const hasVisits = latestVisitByCafe.length > 0 || pendingVisits.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {!hasVisits ? (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Cafés you&apos;ve visited</Text>
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
          <Text style={styles.screenTitle}>Cafés you&apos;ve visited</Text>
          {showMovedToast ? (
            <View style={styles.toastBanner}>
              <Text style={styles.toastBannerText}>Moved to your visits</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>A record of the cafes you’ve visited, rated and remembered.</Text>
          <View style={styles.timelineList}>
            {latestVisitByCafe.map(({ cafe, visit }) => (
              <CompactCafeCard
                key={cafe.id}
                cafe={cafe}
                thumbnailUri={visit.imageUrl ?? undefined}
                metadataLineOverride={
                  visit.rating != null ? `${visit.rating.toFixed(1)} · ${formatVisitDate(visit.createdAt)}` : formatVisitDate(visit.createdAt)
                }
                recommendationReason={visit.note.trim().length > 0 ? `Your thoughts: ${visit.note.trim()}` : undefined}
                scorePosition="cardTopRight"
                reserveTagSpaceWhenEmpty
                tags={visit.tags ?? []}
                maxTags={3}
                onPress={() => router.push(`/cafe/${cafe.id}`)}
              />
            ))}
            {pendingVisits.length > 0 ? (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingSectionTitle}>Pending cafe reviews</Text>
                {pendingVisits.map((visit) => (
                  <View key={visit.id} style={styles.pendingRow}>
                    <View style={styles.pendingTextWrap}>
                      <Text style={styles.pendingName}>{visit.submissionCafeName ?? 'Cafe suggestion'}</Text>
                      <Text style={styles.statusHint} numberOfLines={2}>
                        {visit.submissionStatus === 'rejected'
                          ? 'Not added yet. You can resubmit with clearer details.'
                          : 'Saved to your visits and pending review.'}
                      </Text>
                    </View>
                    {visit.submissionStatus === 'rejected' ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={styles.actionChip}
                        onPress={() =>
                          router.push({
                            pathname: '/suggest-cafe',
                            params: {
                              prefillName: visit.submissionCafeName ?? '',
                              fromVisitLog: '1',
                              visitRating: visit.rating != null ? String(visit.rating) : '',
                              visitTags: visit.tags.join(','),
                              visitNote: visit.note,
                            },
                          })
                        }
                      >
                        <Text style={styles.actionChipText}>Resubmit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
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
    gap: 14,
    marginTop: 4,
  },
  pendingSection: {
    marginTop: 4,
    gap: 8,
  },
  pendingSectionTitle: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pendingRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingTextWrap: {
    flex: 1,
    gap: 3,
  },
  pendingName: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
  },
  statusHint: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
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
