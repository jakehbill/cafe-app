import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CafeCardGrid } from '@/components/layout/CafeCardGrid';
import { DesktopWebPageContainer } from '@/components/layout/DesktopWebPageContainer';
import { VisitedCafeDiaryCard } from '@/components/visit/VisitedCafeDiaryCard';
import type { Cafe } from '@/data/cafes';
import { StackHeaderBackButton } from '@/components/navigation/StackHeaderBackButton';
import { fetchCafesByIdsOrdered } from '@/lib/cafeCatalogSupabase';
import { useAuthRedirectIfNeeded } from '@/hooks/useAuthRedirectIfNeeded';
import { CAFE_DETAIL_RETURN_VISITED } from '@/lib/authGate';
import {
  getUserCafeVisitTimeline,
  type UserCafeVisit,
} from '@/lib/userCafeVisits';

import { COLORS, FONTS } from '@/components/theme';

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatVisitedDateLabel(createdAtIso: string): string | null {
  const ms = Date.parse(createdAtIso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const now = new Date();
  if (isSameLocalDay(d, now)) return 'Visited today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(d, yesterday)) return 'Visited yesterday';

  const dateText = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `Visited ${dateText}`;
}

export default function MyCafesScreen() {
  const router = useRouter();
  const { authReady, authLoading } = useAuthRedirectIfNeeded('/my-cafes');
  const { movedFromSaved } = useLocalSearchParams<{ movedFromSaved?: string | string[] }>();
  const navigation = useNavigation();
  const [visitLogs, setVisitLogs] = useState<UserCafeVisit[]>([]);
  const [cafesById, setCafesById] = useState<Record<string, Cafe>>({});
  const [visitsLoading, setVisitsLoading] = useState(true);
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
      setVisitsLoading(true);
      try {
        const logs = await getUserCafeVisitTimeline();
        const visitCafeIds = Array.from(
          new Set(logs.map((row) => row.cafeId).filter((id): id is string => Boolean(id)))
        );
        const cafes = await fetchCafesByIdsOrdered(visitCafeIds);
        if (cancelled) return;
        const nextMap: Record<string, Cafe> = {};
        for (const cafe of cafes) nextMap[cafe.id] = cafe;
        setVisitLogs(logs);
        setCafesById(nextMap);
      } finally {
        if (!cancelled) setVisitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = useCallback(() => {
    router.replace('/profile');
  }, [router]);

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

  const compactRows = React.useMemo(() => {
    const rows: Array<{ cafe: Cafe; visit: UserCafeVisit }> = [];
    for (const row of latestVisitByCafe) {
      rows.push({ cafe: row.cafe, visit: row.visit });
    }
    return rows;
  }, [latestVisitByCafe]);

  const hasVisits = compactRows.length > 0;
  const showInitialVisitsLoading = visitsLoading && visitLogs.length === 0;

  if (authLoading || !authReady) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.authLoading}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <DesktopWebPageContainer variant="list" style={styles.pageContainer}>
      {showInitialVisitsLoading ? (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Spaces You&apos;ve Worked From</Text>
          <View style={styles.visitsLoadingWrap}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text style={styles.visitsLoadingText}>Loading spaces you&apos;ve worked from…</Text>
          </View>
        </ScrollView>
      ) : !hasVisits ? (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Spaces You&apos;ve Worked From</Text>
          <Text style={styles.hint}>
            Your personal work diary — photos, ratings, and notes from spaces you&apos;ve used.
          </Text>
          {showMovedToast ? (
            <View style={styles.toastBanner}>
              <Text style={styles.toastBannerText}>Moved to spaces you&apos;ve worked from</Text>
            </View>
          ) : null}
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIcon}>+</Text>
            </View>
            <Text style={styles.emptyTitle}>No visits logged yet</Text>
            <Text style={styles.subtitle}>
              When you work from a space, save a few notes here so you can remember where you&apos;ve been.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.ctaButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.ctaButtonText}>Find a space</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {backRow}
          <Text style={styles.screenTitle}>Spaces You&apos;ve Worked From</Text>
          {showMovedToast ? (
            <View style={styles.toastBanner}>
              <Text style={styles.toastBannerText}>Moved to spaces you&apos;ve worked from</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>
            Your personal work diary — photos, ratings, and notes from spaces you&apos;ve used.
          </Text>
          <CafeCardGrid style={styles.timelineList}>
            {compactRows.map(({ cafe, visit }) => (
              <VisitedCafeDiaryCard
                key={`${cafe.id}-${visit.id}`}
                cafe={cafe}
                visit={visit}
                visitedDateLabel={formatVisitedDateLabel(visit.createdAt)}
                maxTags={3}
                onPress={() =>
                  router.push({
                    pathname: '/cafe/[id]',
                    params: { id: cafe.id, returnTo: CAFE_DETAIL_RETURN_VISITED },
                  } as never)
                }
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
  pageContainer: {
    flex: 1,
  },
  authLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitsLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 48,
    paddingHorizontal: 12,
  },
  visitsLoadingText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
    textAlign: 'center',
  },
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
    marginTop: 6,
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
    color: COLORS.buttonLabelOnAccent,
    fontSize: 13,
    fontWeight: '700',
  },
});
