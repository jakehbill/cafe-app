import { AuthBrandBean } from '@/components/auth/AuthBrandBean';
import { PublicCafePreviewCard } from '@/components/public/PublicCafePreviewCard';
import { FlowPrimaryButton } from '@/components/ui/FlowPrimaryButton';
import { COLORS, FONTS } from '@/components/theme';
import type { PublicLandingPageConfig } from '@/lib/publicLandingConfig';
import {
  fetchPublicCafeSample,
  pickCafesForTagSlugs,
  PUBLIC_LANDING_CAFE_MAX,
} from '@/lib/publicLandingCafes';
import type { Cafe } from '@/data/cafes';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BEANED_WEB_URL = 'https://web.beaned.app';

type Props = {
  config: PublicLandingPageConfig;
};

export function PublicLandingPage({ config }: Props) {
  const router = useRouter();
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(!!config.tagSlugs?.length);

  useEffect(() => {
    if (!config.tagSlugs?.length) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const sample = await fetchPublicCafeSample();
      if (cancelled) return;
      const picked = pickCafesForTagSlugs(sample, config.tagSlugs, {
        londonOnly: config.londonOnly,
        max: PUBLIC_LANDING_CAFE_MAX,
      });
      setCafes(picked);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [config.tagSlugs, config.londonOnly]);

  function openJoin() {
    router.push(`/join?source=${encodeURIComponent(config.joinSource)}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.brandRow}>
            <AuthBrandBean />
          </View>

          <Text style={styles.hero}>{config.heroTitle}</Text>
          <Text style={styles.heroSub}>{config.heroSubtitle}</Text>
          <Text style={styles.explanation}>{config.explanation}</Text>

          {config.tagLabels && config.tagLabels.length > 0 ? (
            <View style={styles.tagCloud}>
              {config.tagLabels.map((label) => (
                <View key={label} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {config.steps && config.steps.length > 0 ? (
            <View style={styles.steps}>
              {config.steps.map((step, index) => (
                <View key={step.title} style={styles.stepCard}>
                  <Text style={styles.stepKicker}>Step {index + 1}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {config.tagSlugs?.length ? (
            <View style={styles.cafeSection}>
              <Text style={styles.sectionLabel}>Curated picks</Text>
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.loadingText}>Loading cafés…</Text>
                </View>
              ) : cafes.length > 0 ? (
                <View style={styles.cafeList}>
                  {cafes.map((cafe) => (
                    <PublicCafePreviewCard key={cafe.id} cafe={cafe} />
                  ))}
                </View>
              ) : (
                <View style={styles.fallbackCard}>
                  <Text style={styles.fallbackTitle}>More picks coming soon</Text>
                  <Text style={styles.fallbackBody}>{config.fallbackBlurb}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.fallbackCard}>
              <Text style={styles.fallbackBody}>{config.fallbackBlurb}</Text>
            </View>
          )}

          <View style={styles.ctaBlock}>
            <FlowPrimaryButton label="Join the beta" onPress={openJoin} />
            {config.showBrowseLink ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(BEANED_WEB_URL)}
                style={styles.browseHit}
              >
                <Text style={styles.browseText}>Browse Beaned</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingBottom: 36 },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 16,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  brandRow: { alignItems: 'center', marginBottom: 4 },
  hero: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    textAlign: 'center',
  },
  explanation: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONTS.sans.regular,
    color: COLORS.text,
    textAlign: 'center',
    opacity: 0.92,
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.chipBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagPillText: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.roastedBrown,
  },
  steps: { gap: 10, marginTop: 4 },
  stepCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 6,
  },
  stepKicker: {
    fontSize: 11,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontSize: 17,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  stepBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
  },
  cafeSection: { gap: 12, marginTop: 8 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  cafeList: { gap: 10 },
  loadingWrap: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  loadingText: { fontSize: 14, fontFamily: FONTS.sans.regular, color: COLORS.muted },
  fallbackCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 8,
  },
  fallbackTitle: {
    fontSize: 16,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    textAlign: 'center',
  },
  fallbackBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONTS.sans.regular,
    color: COLORS.muted,
    textAlign: 'center',
  },
  ctaBlock: { gap: 14, marginTop: 12, paddingTop: 8 },
  browseHit: { alignSelf: 'center', paddingVertical: 6 },
  browseText: {
    fontSize: 15,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.accent,
    textDecorationLine: 'underline',
  },
});
