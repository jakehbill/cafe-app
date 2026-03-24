import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../(tabs)/components/theme';

const QUICK_RATING_GROUPS = [
  { label: 'Coffee', value: '9.0' },
  { label: 'Work', value: '8.5' },
  { label: 'Quick', value: '8.0' },
  { label: 'Vibe', value: '9.2' },
] as const;

const TAGS = [
  'Quiet',
  'Laptop Friendly',
  'Good for Calls',
  'Fast Service',
  'Specialty Coffee',
  'Social',
] as const;

const MOCK_CAFE = {
  name: 'Moss & Co. Coffee',
  neighborhood: 'Downtown • Elm Street',
} as const;

function RatingPill({ label, value }: { label: string; value: string }) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.ratingPill}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <Text style={styles.ratingValue}>{value}</Text>
    </TouchableOpacity>
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.tagChip}>
      <Text style={styles.tagChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function RateCafeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Rate this cafe</Text>

        <View style={styles.previewCard}>
          <View style={styles.previewImage} />
          <View style={styles.previewTextWrap}>
            <Text style={styles.previewName}>{MOCK_CAFE.name}</Text>
            <Text style={styles.previewNeighborhood}>{MOCK_CAFE.neighborhood}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick ratings</Text>
          <View style={styles.ratingGrid}>
            {QUICK_RATING_GROUPS.map((rating) => (
              <RatingPill key={rating.label} label={rating.label} value={rating.value} />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsWrap}>
            {TAGS.map((tag) => (
              <TagChip key={tag} label={tag} />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add a quick note about your visit..."
            placeholderTextColor={COLORS.muted}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity activeOpacity={0.88} style={styles.submitButton}>
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

  headerTitle: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 34,
    marginTop: 2,
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

  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ratingPill: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 14,
    padding: 10,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  ratingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 2,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
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
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  notesInput: {
    minHeight: 94,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
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
  submitButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

