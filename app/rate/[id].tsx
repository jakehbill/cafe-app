import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React, { useLayoutEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, FONTS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import type { Cafe } from '@/data/cafes';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { TagWithOptionalIcon } from '@/components/TagWithOptionalIcon';
import { ALL_RATING_TAGS, TAG_SECTIONS } from '@/lib/cafeTags';
import { getUserCoffeeRating, rateCafe } from '@/lib/supabase';

function rateDebug(label: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  try {
    console.log(`[RATE DEBUG] ${label}\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log(`[RATE DEBUG] ${label}`, payload);
  }
}

function StarRatingRow({
  value,
  onSelect,
}: {
  value: number;
  onSelect: (rating: number) => void;
}) {
  const filled = Math.min(5, Math.max(0, Math.round(value)));
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${n} out of 5 stars`}
          accessibilityState={{ selected: n <= filled }}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          onPress={() => onSelect(n)}
        >
          <Ionicons
            name={n <= filled ? 'star' : 'star-outline'}
            size={34}
            color={n <= filled ? COLORS.accent : 'rgba(92, 86, 80, 0.38)'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function RateCafeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { setCafeRating, getCafeRating } = useCafeState();
  const cafeId = Array.isArray(id) ? id[0] : id;
  const targetCafeId = cafeId ?? '1';
  const [cafe, setCafe] = useState<Cafe | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const row = await fetchCafeByIdFromSupabase(String(targetCafeId));
      if (!cancelled) setCafe(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetCafeId]);

  const existingRating = getCafeRating(targetCafeId);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: cafe?.name ? `Rate · ${cafe.name}` : 'Rate Cafe',
    });
  }, [cafe?.name, navigation]);

  const [coffeeScore, setCoffeeScore] = useState(existingRating?.coffee ?? 0);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    (existingRating?.tags ?? []).filter((tag) => ALL_RATING_TAGS.includes(tag as (typeof ALL_RATING_TAGS)[number])).slice(0, 3)
  );
  const [notes, setNotes] = useState(existingRating?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreviousRating() {
      // Prefill coffee from `user_cafe_ratings.coffee` only (aligned with `ratings.coffee_rating`).
      const numericCafeId = Number.parseInt(targetCafeId, 10);
      if (!Number.isFinite(numericCafeId)) return;

      const prev = await getUserCoffeeRating(numericCafeId);
      if (cancelled || prev === null) return;

      if (coffeeScore !== 0) return;
      if (existingRating) return;

      const v = Math.min(5, Math.max(1, Math.round(prev)));
      setCoffeeScore(v);
    }

    void loadPreviousRating();
    return () => {
      cancelled = true;
    };
  }, [targetCafeId, existingRating, coffeeScore]);

  const hasAnyRating = coffeeScore > 0;

  const submitDisabled = !hasAnyRating || submitted || submitting;

  React.useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => {
      router.replace(`/cafe/${targetCafeId}`);
    }, 2000);
    return () => clearTimeout(t);
  }, [submitted, targetCafeId, router]);

  React.useEffect(() => {
    if (!__DEV__) return;
    rateDebug('submit button state', {
      platform: Platform.OS,
      hasAnyRating,
      submitted,
      submitDisabled,
      coffeeScore,
      targetCafeId,
    });
  }, [hasAnyRating, submitted, submitDisabled, coffeeScore, targetCafeId]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  }

  async function handleSubmit() {
    rateDebug('handleSubmit invoked', {
      platform: Platform.OS,
      targetCafeId,
      coffeeScore,
      submitDisabledExpected: !hasAnyRating || submitted,
    });

    const ratingData = {
      coffee: coffeeScore,
      tags: selectedTags,
      notes: notes.trim(),
    };

    rateDebug('computed payload', {
      ...ratingData,
      coffeeRatingSentToRatings: coffeeScore,
    });

    if (!hasAnyRating) {
      rateDebug('early exit: validation', {
        reason: 'no dimension > 0 — submit should have been disabled',
      });
      return;
    }
    if (submitted) {
      rateDebug('early exit: already submitted', {});
      return;
    }
    if (submitting) {
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      rateDebug('calling rateCafe', { targetCafeId });
      const rateRes = await rateCafe(targetCafeId, {
        coffee: coffeeScore,
        tags: selectedTags,
        notes: notes.trim(),
      });
      rateDebug('rateCafe result', { ok: rateRes.ok, error: rateRes.ok ? null : rateRes.error });
      if (!rateRes.ok) {
        throw new Error(rateRes.error);
      }

      rateDebug('calling setCafeRating (context refresh)', { targetCafeId });
      await setCafeRating(targetCafeId, ratingData);
      setSubmitted(true);
      rateDebug('submit success', { targetCafeId });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Your rating could not be saved. Try again.';
      rateDebug('submit error', { message });
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>Rate this cafe</Text>
          <Text style={styles.pageSubtitle}>Help others find great cafes</Text>
        </View>

        <View style={styles.previewCard}>
          {cafe?.imageUrl ? (
            <Image source={{ uri: cafe.imageUrl }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={[styles.previewImage, styles.previewImagePlaceholder]} />
          )}
          <View style={styles.previewTextWrap}>
            <Text style={styles.previewName}>{cafe?.name ?? 'Cafe'}</Text>
            <Text style={styles.previewNeighborhood}>
              {cafe?.neighborhood ?? 'Neighborhood'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Rating</Text>
          <Text style={styles.ratingPrompt}>How was it?</Text>
          <View style={styles.ratingRowsWrap}>
            <StarRatingRow
              value={coffeeScore}
              onSelect={(value) => {
                setCoffeeScore(value);
              }}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What stood out? (pick up to 3)</Text>
          {TAG_SECTIONS.map((section) => (
            <View key={section.title} style={styles.tagSection}>
              <Text style={styles.tagSectionTitle}>{section.title}</Text>
              <View style={styles.tagsWrap}>
                {section.tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    activeOpacity={0.85}
                    style={[
                      styles.tagChip,
                      selectedTags.includes(tag) && styles.tagChipSelected,
                    ]}
                    onPress={() => toggleTag(tag)}
                  >
                    <TagWithOptionalIcon
                      tag={tag}
                      iconSize={14}
                      color={selectedTags.includes(tag) ? COLORS.accent : COLORS.text}
                      textStyle={[
                        styles.tagChipText,
                        selectedTags.includes(tag) && styles.tagChipTextSelected,
                      ]}
                      gap={5}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Anything to note?"
            placeholderTextColor={COLORS.muted}
            multiline
            textAlignVertical="top"
            numberOfLines={2}
            maxLength={180}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {submitError ? (
          <View style={styles.feedbackBanner} accessibilityLiveRegion="polite">
            <Text style={styles.feedbackErrorText}>{submitError}</Text>
          </View>
        ) : null}

        {submitted ? (
          <View style={styles.feedbackBannerSuccess} accessibilityLiveRegion="polite">
            <Text style={styles.feedbackSuccessTitle}>Rating saved</Text>
            <Text style={styles.feedbackSuccessSub}>Returning to the cafe page…</Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.submitButton,
            submitDisabled && styles.submitButtonDisabled,
            submitted && styles.submitButtonSuccess,
          ]}
          onPress={() => void handleSubmit()}
          disabled={submitDisabled}
        >
          <Text style={styles.submitButtonText}>
            {submitted ? 'Rating saved' : submitting ? 'Saving…' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  titleBlock: {
    gap: 8,
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FONTS.display.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    fontFamily: FONTS.sans.regular,
    letterSpacing: -0.1,
  },

  previewCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: COLORS.imagePlaceholder,
  },
  previewImagePlaceholder: {
    backgroundColor: COLORS.imagePlaceholder,
  },
  previewTextWrap: {
    flex: 1,
    gap: 4,
  },
  previewName: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: FONTS.sans.semibold,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  previewNeighborhood: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    fontFamily: FONTS.sans.regular,
  },

  sectionCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: FONTS.sans.semibold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  ratingPrompt: {
    fontSize: 15,
    fontFamily: FONTS.sans.medium,
    color: COLORS.text,
    letterSpacing: -0.1,
    marginBottom: 2,
  },

  ratingRowsWrap: {
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 320,
    alignSelf: 'stretch',
    paddingVertical: 4,
  },
  notesInput: {
    minHeight: 68,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },

  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  tagSection: {
    gap: 8,
  },
  tagSectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.2,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipSelected: {
    backgroundColor: COLORS.accentSubtleFill,
    borderColor: COLORS.accentSubtleBorder,
  },
  tagChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  tagChipTextSelected: {
    color: COLORS.accent,
  },

  feedbackBanner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(180, 80, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(180, 80, 80, 0.28)',
  },
  feedbackErrorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#8B4A4A',
    textAlign: 'center',
  },
  feedbackBannerSuccess: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(163, 177, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.45)',
    gap: 4,
  },
  feedbackSuccessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A5A49',
    textAlign: 'center',
  },
  feedbackSuccessSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5F6B58',
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accentSubtleBorder,
    marginTop: 2,
  },
  submitButtonDisabled: {
    opacity: 0.88,
  },
  submitButtonSuccess: {
    backgroundColor: 'rgba(163, 177, 138, 0.45)',
    borderColor: 'rgba(163, 177, 138, 0.8)',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: FONTS.sans.semibold,
    textAlign: 'center',
  },
});

