import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { FilterChip } from './components/FilterChip';
import { SearchBar } from './components/SearchBar';
import { cafes, type Cafe } from '../../data/cafes';

const FILTER_CHIPS = ['Work', 'Quick', 'Specialty', 'Quiet', 'Social'] as const;

function HomeCafeCard({
  cafe,
  onPress,
}: {
  cafe: Cafe;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.featuredCard} onPress={onPress}>
      <View style={styles.featuredImagePlaceholder} />

      <View style={styles.featuredBody}>
        <Text style={styles.featuredName}>{cafe.name}</Text>
        <Text style={styles.featuredNeighborhood}>{cafe.neighborhood}</Text>

        <View style={styles.equalScoresRow}>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Coffee</Text>
            <Text style={styles.equalScoreValue}>{Math.round(cafe.coffeeScore * 10)}</Text>
          </View>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Work</Text>
            <Text style={styles.equalScoreValue}>{Math.round(cafe.workScore * 10)}</Text>
          </View>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Vibe</Text>
            <Text style={styles.equalScoreValue}>{Math.round(cafe.vibeScore * 10)}</Text>
          </View>
        </View>

        <View style={styles.featuredTagsRow}>
          {cafe.tags.slice(0, 5).map((tag) => (
            <View key={tag} style={styles.featuredTag}>
              <Text style={styles.featuredTagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text numberOfLines={2} style={styles.featuredSummary}>
          {cafe.summary}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<(typeof FILTER_CHIPS)[number]>('Work');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topSection}>
          <View style={styles.headerBlock}>
            <Text style={styles.headerText}>Find your perfect cafe</Text>
            <Text style={styles.headerSubtext}>Work, coffee, or just a great spot</Text>
          </View>

          <SearchBar placeholder="Search cafes..." />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {FILTER_CHIPS.map((label) => (
              <FilterChip
                key={label}
                label={label}
                selected={selectedFilter === label}
                onPress={() => setSelectedFilter(label)}
              />
            ))}
          </ScrollView>

          <View style={styles.sectionIntro}>
            <Text style={styles.sectionTitle}>Featured Today</Text>
            <Text style={styles.sectionSubtitle}>Editor&apos;s pick for remote work</Text>
          </View>

          {cafes.map((cafe) => (
            <HomeCafeCard
              key={cafe.id}
              cafe={cafe}
              onPress={() => router.push(`/cafe/${cafe.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F3EE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
  },
  topSection: {
    gap: 18,
  },
  headerBlock: {
    gap: 6,
    marginTop: 2,
  },

  headerText: {
    fontSize: 36,
    color: '#2E2A27',
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 40,
  },
  headerSubtext: {
    fontSize: 15,
    lineHeight: 20,
    color: '#6F6355',
  },

  chipsRow: {
    paddingTop: 4,
    gap: 10,
    paddingRight: 12,
  },
  sectionIntro: {
    gap: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 35,
    lineHeight: 40,
    fontWeight: '700',
    color: '#2E2A27',
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6E6254',
  },

  featuredCard: {
    marginTop: 6,
    backgroundColor: '#F7F3EE',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE4D6',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  featuredImagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 2,
    backgroundColor: '#E9E2D6',
  },
  featuredBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
  },
  featuredName: {
    fontSize: 21,
    fontWeight: '700',
    color: '#2E2A27',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  featuredNeighborhood: {
    fontSize: 13,
    color: '#6E6254',
    lineHeight: 18,
  },
  equalScoresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  equalScoreBlock: {
    flex: 1,
    backgroundColor: '#F1E9DC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7DDCD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  equalScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F5346',
  },
  equalScoreValue: {
    fontSize: 27,
    fontWeight: '700',
    color: '#2E2A27',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  featuredTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  featuredTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8F5F0',
    borderWidth: 1,
    borderColor: '#ECE2D3',
  },
  featuredTagText: {
    color: '#5E5348',
    fontSize: 12,
    fontWeight: '500',
  },
  featuredSummary: {
    color: '#4F4740',
    fontSize: 14,
    lineHeight: 22,
  },
});