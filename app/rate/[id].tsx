import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../(tabs)/components/theme';

const RATING_CATEGORIES = [
  { key: 'coffee', label: 'How tasty was the coffee?' },
  { key: 'work', label: 'Was it a good place to work?' },
  { key: 'quick', label: 'How quick was the ordering process?' },
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

const MOCK_CAFE = {
  name: 'Moss & Co. Coffee',
  neighborhood: 'Downtown • Elm Street',
} as const;

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
  const { id } = useLocalSearchParams<{ id?: string }>();

  // Local state keeps the screen interactive without backend wiring.
  const [coffeeScore, setCoffeeScore] = useState(0);
  const [workScore, setWorkScore] = useState(0);
  const [quickScore, setQuickScore] = useState(0);
  const [vibeScore, setVibeScore] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const hasAnyRating =
    coffeeScore > 0 || workScore > 0 || quickScore > 0 || vibeScore > 0;

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  function handleSubmit() {
    const payload = {
      cafeId: id ?? '1',
      ratings: {
        coffee: coffeeScore,
        work: workScore,
        quick: quickScore,
        vibe: vibeScore,
      },
      tags: selectedTags,
      notes: notes.trim(),
    };

    console.log('Rate cafe payload:', payload);
    Alert.alert('Thanks!', 'Your rating was submitted.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.headerTitle}>Rate this cafe</Text>
        <Text style={styles.headerSubtitle}>
          Help others find great places to work
        </Text>

        <View style={styles.previewCard}>
          <View style={styles.previewImage} />
          <View style={styles.previewTextWrap}>
            <Text style={styles.previewName}>{MOCK_CAFE.name}</Text>
            <Text style={styles.previewNeighborhood}>{MOCK_CAFE.neighborhood}</Text>
            <Text style={styles.previewId}>Cafe #{id ?? '1'}</Text>
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
                      : category.key === 'quick'
                        ? quickScore
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
                  if (category.key === 'quick') {
                    setQuickScore(value);
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
            !hasAnyRating && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
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
  headerRow: {
    alignItems: 'flex-start',
  },
  backButton: {
    borderRadius: 999,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  headerTitle: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 34,
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    marginTop: -6,
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
  submitButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

