import { useNavigation } from '@react-navigation/native';
import React, { useLayoutEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
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

const RATING_CATEGORIES = [
  { key: 'coffee', label: 'How tasty was the coffee?' },
  { key: 'work', label: 'Was it a good place to work?' },
  { key: 'vibe', label: 'How was the overall atmosphere?' },
] as const;

const TAGS = [
  'Quiet',
  'Laptop Friendly',
  'Good for Calls',
  'Fast Service',
  'Specialty Coffee',
  'Great Seating',
  'Social Spot',
  'Busy',
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
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => {
          const selected = value === rating;
          return (
            <TouchableOpacity
              key={rating}
              activeOpacity={0.85}
              style={[styles.ratingOption, selected && styles.ratingOptionSelected]}
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
            </TouchableOpacity>
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
  const [selectedTags, setSelectedTags] = useState<string[]>(existingRating?.tags ?? []);
  const [notes, setNotes] = useState(existingRating?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);

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

      const v = Math.min(10, Math.max(1, Math.round(prev)));
      setCoffeeScore(v);
      setWorkScore(v);
      setVibeScore(v);
    }

    void loadPreviousRating();
    return () => {
      cancelled = true;
    };
  }, [targetCafeId, existingRating, coffeeScore, workScore, vibeScore]);

  const hasAnyRating =
    coffeeScore > 0 || workScore > 0 || vibeScore > 0;

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
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

    console.log('Rate cafe payload:', {
      cafeId: targetCafeId,
      ...ratingData,
      ratingValue,
    });

    try {
      const numericCafeId = Number.parseInt(targetCafeId, 10);
      if (Number.isFinite(numericCafeId)) {
        // Save to Supabase so this rating persists across devices.
        const res = await rateCafe(numericCafeId, {
          coffee: coffeeScore,
          work: workScore,
          vibe: vibeScore,
          overall: ratingValue,
        });
        if (!res.ok) {
          throw new Error(res.error);
        }
      }

      await setCafeRating(targetCafeId, ratingData);
      setSubmitted(true);
      Alert.alert('Thanks!', 'Your rating was submitted.', [
        { text: 'OK', onPress: () => router.replace(`/cafe/${targetCafeId}`) },
      ]);
    } catch {
      Alert.alert('Could not save', 'Your rating could not be saved. Check your connection and try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
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
          <Text style={styles.sectionTitle}>Quick ratings</Text>
          <View style={styles.ratingRowsWrap}>
            {RATING_CATEGORIES.map((category) => (
              <RatingRow
                key={category.key}
                label={category.label}
                value={
                  category.key === 'coffee'
                    ? coffeeScore
                    : category.key === 'work'
                      ? workScore
                      : vibeScore
                }
                onSelect={(value) => {
                  if (category.key === 'coffee') {
                    setCoffeeScore(value);
                    return;
                  }
                  if (category.key === 'work') {
                    setWorkScore(value);
                    return;
                  }
                  setVibeScore(value);
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What stood out?</Text>
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

        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.submitButton,
            (!hasAnyRating || submitted) && styles.submitButtonDisabled,
            submitted && styles.submitButtonSuccess,
          ]}
          onPress={handleSubmit}
          disabled={!hasAnyRating || submitted}
        >
          <Text style={styles.submitButtonText}>
            {submitted ? 'Submitted' : 'Submit'}
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

