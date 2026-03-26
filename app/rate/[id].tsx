import { useNavigation } from '@react-navigation/native';
import React, { useLayoutEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/components/theme';
import { useCafeState } from '@/contexts/CafeStateContext';
import type { Cafe } from '@/data/cafes';
import { fetchCafeByIdFromSupabase } from '@/lib/cafeCatalogSupabase';
import { getUserRating, rateCafe } from '@/lib/supabase';

function rateDebug(label: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  try {
    console.log(`[RATE DEBUG] ${label}\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log(`[RATE DEBUG] ${label}`, payload);
  }
}

const TAGS = [
  'good_for_working',
  'quiet',
  'busy',
  'aesthetic',
  'great_espresso',
  'great_filter',
  'specialty_coffee',
  'cosy',
  'spacious',
  'quick_stop',
  'brunch_spot',
  'great_pastries',
  'good_food',
  'vegan_options',
] as const;

function RatingRow({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: number;
  onSelect: (rating: number) => void;
}) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingRowLabel}>{label}</Text>
      <View style={styles.ratingOptions}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating;
          return (
            <Pressable
              key={rating}
              style={({ pressed }) => [
                styles.ratingOption,
                selected && styles.ratingOptionSelected,
                pressed && styles.ratingOptionPressed,
              ]}
              onPress={() => onSelect(rating)}
            >
              <Text
                style={[
                  styles.ratingOptionText,
                  selected && styles.ratingOptionTextSelected,
                ]}
              >
                {rating}
              </Text>
            </Pressable>
          );
        })}
      </View>
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

  // Local state keeps the screen interactive without backend wiring.
  const [coffeeScore, setCoffeeScore] = useState(existingRating?.coffee ?? 0);
  const [workScore, setWorkScore] = useState(existingRating?.work ?? 0);
  const [vibeScore, setVibeScore] = useState(existingRating?.vibe ?? 0);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    (existingRating?.tags ?? []).filter((tag) => TAGS.includes(tag as (typeof TAGS)[number])).slice(0, 3)
  );
  const [notes, setNotes] = useState(existingRating?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreviousRating() {
      // Load a previously-saved overall rating from Supabase (if one exists) to pre-fill the UI.
      const numericCafeId = Number.parseInt(targetCafeId, 10);
      if (!Number.isFinite(numericCafeId)) return;

      const prev = await getUserRating(numericCafeId);
      if (cancelled || prev === null) return;

      // Only prefill when the user hasn't started rating yet and no per-dimension rating is present.
      if (coffeeScore !== 0 || workScore !== 0 || vibeScore !== 0) return;
      if (existingRating) return;

      const v = Math.min(5, Math.max(1, Math.round(prev)));
      setCoffeeScore(v);
      setWorkScore(v);
      setVibeScore(v);
    }

    void loadPreviousRating();
    return () => {
      cancelled = true;
    };
  }, [targetCafeId, existingRating, coffeeScore, workScore, vibeScore]);

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
      workScore,
      vibeScore,
      targetCafeId,
    });
  }, [hasAnyRating, submitted, submitDisabled, coffeeScore, workScore, vibeScore, targetCafeId]);

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
      workScore,
      vibeScore,
      submitDisabledExpected: !hasAnyRating || submitted,
    });

    const ratingData = {
      coffee: coffeeScore,
      work: workScore,
      vibe: vibeScore,
      tags: selectedTags,
      notes: notes.trim(),
    };

    // Final 0–10 rating saved to Supabase `ratings` table (simple average of the scores you set).
    const parts = [coffeeScore, workScore, vibeScore].filter((v) => v > 0);
    const ratingValue = parts.length > 0 ? parts.reduce((sum, v) => sum + v, 0) / parts.length : 0;

    rateDebug('computed payload', {
      ...ratingData,
      ratingValue,
      partsUsedInAverage: parts,
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
        work: workScore,
        vibe: vibeScore,
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
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.leadText}>Help others find great places to work</Text>

        <View style={styles.previewCard}>
          <View style={styles.previewImage} />
          <View style={styles.previewTextWrap}>
            <Text style={styles.previewName}>{cafe?.name ?? 'Cafe'}</Text>
            <Text style={styles.previewNeighborhood}>
              {cafe?.neighborhood ?? 'Neighborhood'}
            </Text>
            <Text style={styles.previewId}>Cafe #{targetCafeId}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Coffee rating</Text>
          <View style={styles.ratingRowsWrap}>
            <RatingRow
              label="How was the coffee?"
              value={coffeeScore}
              onSelect={(value) => {
                // Keep backend payload shape unchanged for now.
                setCoffeeScore(value);
                setWorkScore(value);
                setVibeScore(value);
              }}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What stood out? (pick up to 3)</Text>
          <View style={styles.tagsWrap}>
            {TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                activeOpacity={0.85}
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag) && styles.tagChipSelected,
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    selectedTags.includes(tag) && styles.tagChipTextSelected,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
  },
  leadText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    marginBottom: 4,
  },

  previewCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: COLORS.imagePlaceholder,
  },
  previewTextWrap: {
    flex: 1,
    gap: 4,
  },
  previewName: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '700',
    lineHeight: 22,
  },
  previewNeighborhood: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  previewId: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 16,
  },

  sectionCard: {
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
  },

  ratingRowsWrap: {
    gap: 10,
  },
  ratingRow: {
    gap: 8,
  },
  ratingRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  ratingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingOption: {
    minWidth: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  ratingOptionSelected: {
    backgroundColor: COLORS.roastedBrown,
    borderColor: 'rgba(138, 106, 79, 0.55)',
  },
  ratingOptionPressed: {
    opacity: 0.88,
  },
  ratingOptionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  ratingOptionTextSelected: {
    color: COLORS.background,
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
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagChipSelected: {
    backgroundColor: 'rgba(163, 177, 138, 0.24)',
    borderColor: 'rgba(163, 177, 138, 0.5)',
  },
  tagChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  tagChipTextSelected: {
    color: '#4A5A49',
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
    backgroundColor: COLORS.roastedBrown,
    borderWidth: 1,
    borderColor: 'rgba(138, 106, 79, 0.55)',
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
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

