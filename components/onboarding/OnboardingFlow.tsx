import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthBrandBean } from '@/components/auth/AuthBrandBean';
import { COLORS, FONTS, SPACING } from '@/components/theme';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';
import { FlowSecondaryButton } from '@/components/ui/FlowSecondaryButton';

const HERO_URI =
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1080&q=80';

const SLIDE_COUNT = 4;

function Pagination({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.paginationRow}>
      {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.paginationDot,
            i === activeIndex ? styles.paginationDotActive : styles.paginationDotInactive,
          ]}
        />
      ))}
    </View>
  );
}

function FilterPreviewCard() {
  const pills: { label: string; selected: boolean }[] = [
    { label: 'Best for Work', selected: true },
    { label: 'Quick', selected: false },
    { label: 'Specialty Coffee', selected: true },
    { label: 'Most quiet', selected: false },
    { label: 'Social', selected: false },
  ];

  return (
    <View style={styles.filterCard}>
      <Text style={styles.filterCardKicker}>CHOOSE WHAT MATTERS</Text>
      <View style={styles.filterPillWrap}>
        {pills.map((p) => (
          <View
            key={p.label}
            style={[styles.filterPill, p.selected ? styles.filterPillOn : styles.filterPillOff]}
          >
            <Text style={[styles.filterPillText, p.selected && styles.filterPillTextOn]}>
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SavedPreviewCard() {
  const rows = [
    {
      state: 'Saved',
      name: 'Oat & Ember',
      meta: 'Shoreditch · 4.6',
      note: 'Specialty coffee, cozy corners',
    },
    {
      state: 'Visited',
      name: 'Railhouse Coffee',
      meta: 'Soho · 0.8 mi',
      note: 'Fast service, good for quick stops',
    },
    {
      state: 'Top pick for you',
      name: 'Northline Roasters',
      meta: 'Camden · 4.7',
      note: 'Matches your saved coffee style',
    },
  ];

  return (
    <View style={styles.savedCard}>
      {rows.map((row) => (
        <View key={row.name} style={styles.savedRow}>
          <View style={styles.savedTextCol}>
            <Text style={styles.savedStatePill}>{row.state}</Text>
            <Text style={styles.savedName}>{row.name}</Text>
            <Text style={styles.savedDetail}>{row.meta}</Text>
            <Text style={styles.savedNote} numberOfLines={1}>
              {row.note}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

type SlideRenderProps = {
  index: number;
  slideWidth: number;
};

function SlideBody({ index, slideWidth }: SlideRenderProps) {
  const innerPad = { paddingHorizontal: 28, width: slideWidth };

  if (index === 0) {
    return (
      <View style={[styles.slideInner, innerPad]}>
        <Image
          source={{ uri: HERO_URI }}
          style={styles.heroImage}
          contentFit="cover"
          transition={200}
          accessibilityLabel="Cozy cafe interior"
        />
        <Text style={styles.headline}>Find your perfect cafe</Text>
        <Text style={styles.bodyCopy}>
          Discover the best spots for work, coffee, and everything in between
        </Text>
      </View>
    );
  }

  if (index === 1) {
    return (
      <View style={[styles.slideInner, innerPad]}>
        <FilterPreviewCard />
        <Text style={[styles.headline, styles.headlineBelowArt]}>
          Find work, quick stops or specialty coffee: wherever you are
        </Text>
        <Text style={styles.bodyCopy}>
          Filter by what you need right now: quiet, fast, or specialty.
        </Text>
      </View>
    );
  }

  if (index === 2) {
    return (
      <View style={[styles.slideInner, innerPad]}>
        <SavedPreviewCard />
        <Text style={[styles.headline, styles.headlineBelowArt]}>Your picks, saved in one place</Text>
        <Text style={styles.bodyCopy}>
          Bookmark cafes, track visits, and build a list that matches how you actually explore
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.slideInner, innerPad, styles.ctaSlide]}>
      <AuthBrandBean />
      <Text style={[styles.headline, styles.headlineBelowBean]}>Ready to find the perfect cafe?</Text>
      <Text style={styles.bodyCopy}>
        Create an account or log in to start discovering cafes tailored to you.
      </Text>
    </View>
  );
}

export default function OnboardingFlow() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const skipToAuth = useCallback(() => {
    router.replace('/auth');
  }, [router]);

  const goNext = useCallback(() => {
    if (page >= SLIDE_COUNT - 1) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPage((prev) => Math.min(SLIDE_COUNT - 1, prev + 1));
  }, [page, width]);

  const isLast = page === SLIDE_COUNT - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.skipRow}>
        <Pressable onPress={skipToAuth} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip onboarding">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.pager}>
        <View style={[styles.slidePage, { width }]}>
          <SlideBody index={page} slideWidth={width} />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(20, 12 + insets.bottom) }]}>
        <Pagination activeIndex={page} />
        {isLast ? (
          <View style={styles.ctaStack}>
            <FlowPrimaryButton label="Sign up" onPress={() => router.push('/auth')} />
            <FlowSecondaryButton label="Log in" onPress={() => router.push('/login')} />
          </View>
        ) : (
          <FlowPrimaryButton label="Next" onPress={goNext} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  skipRow: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 16,
    fontFamily: FONTS.sans.medium,
    color: COLORS.muted,
  },
  pager: {
    flex: 1,
  },
  slidePage: {
    flex: 1,
  },
  slideInner: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  ctaSlide: {
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1.05,
    maxHeight: 340,
    borderRadius: 28,
    marginBottom: SPACING.sectionGap,
    backgroundColor: COLORS.imagePlaceholder,
  },
  headline: {
    fontSize: 34,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  headlineBelowArt: {
    marginTop: SPACING.sectionGap,
  },
  /** Extra air below the brand bean on the final CTA slide. */
  headlineBelowBean: {
    marginTop: 4,
  },
  bodyCopy: {
    marginTop: 14,
    fontSize: 16,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  filterCard: {
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 18,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterCardKicker: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    letterSpacing: 0.6,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  filterPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  filterPillOn: {
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
  },
  filterPillOff: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterPillText: {
    fontSize: 14,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
  },
  filterPillTextOn: {
    color: '#ffffff',
    fontFamily: FONTS.sans.semibold,
  },
  savedCard: {
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 8,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  savedTextCol: {
    flex: 1,
    gap: 2,
  },
  savedStatePill: {
    alignSelf: 'flex-start',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
    backgroundColor: COLORS.accentSubtleFill,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  savedName: {
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
  },
  savedDetail: {
    fontSize: 12,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  savedNote: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
  paginationDotActive: {
    width: 28,
    backgroundColor: COLORS.accent,
  },
  paginationDotInactive: {
    width: 8,
    backgroundColor: COLORS.cardBorder,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  ctaStack: {
    gap: 12,
  },
});
