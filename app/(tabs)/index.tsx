import React, { useMemo } from 'react';
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
import { cafes, type Cafe } from '../../data/cafes';
import { useCafeState } from '@/contexts/CafeStateContext';
import { buildTasteProfileFromState, rankCafesForHome } from '@/lib/cafeRanking';
import { getRecommendationReason } from '@/lib/recommendationReason';

const MAX_VISIBLE_TAGS = 3;

const BROWSE_BY = [
  { label: 'Best for Work', rank: 'work' as const },
  { label: 'Great Coffee', rank: 'coffee' as const },
  { label: 'Great Atmosphere', rank: 'atmosphere' as const },
  { label: 'Quiet Spots', rank: 'quiet' as const },
];

function getVisibleTags(tags: string[]) {
  return tags.slice(0, MAX_VISIBLE_TAGS);
}

function HomeCafeCard({
  cafe,
  localRating,
  recommendationReason,
  onPress,
}: {
  cafe: Cafe;
  localRating?: {
    coffee: number;
    work: number;
    vibe: number;
  };
  recommendationReason: string;
  onPress: () => void;
}) {
  const displayScores = localRating
    ? {
        coffee: localRating.coffee,
        work: localRating.work,
        vibe: localRating.vibe,
      }
    : {
        coffee: cafe.coffeeScore,
        work: cafe.workScore,
        vibe: cafe.vibeScore,
      };

  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.featuredCard} onPress={onPress}>
      <View style={styles.featuredImagePlaceholder} />

      <View style={styles.featuredBody}>
        <Text style={styles.featuredName}>{cafe.name}</Text>
        <Text style={styles.featuredReason} numberOfLines={1}>
          {recommendationReason}
        </Text>
        <Text style={styles.featuredNeighborhood}>{cafe.neighborhood}</Text>
        {localRating ? (
          <View style={styles.ratedBadge}>
            <Text style={styles.ratedBadgeText}>Rated by you</Text>
          </View>
        ) : null}

        <View style={styles.equalScoresRow}>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Coffee</Text>
            <Text style={styles.equalScoreValue}>{displayScores.coffee.toFixed(1)}</Text>
          </View>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Work</Text>
            <Text style={styles.equalScoreValue}>{displayScores.work.toFixed(1)}</Text>
          </View>
          <View style={styles.equalScoreBlock}>
            <Text style={styles.equalScoreLabel}>Vibe</Text>
            <Text style={styles.equalScoreValue}>{displayScores.vibe.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.featuredTagsRow}>
          {getVisibleTags(cafe.tags).map((tag) => (
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
  const { ratingsByCafeId } = useCafeState();

  const tasteProfile = useMemo(
    () => buildTasteProfileFromState(ratingsByCafeId, cafes),
    [ratingsByCafeId]
  );

  /** Same base ordering as Search (no query, no chip) + optional taste personalization. */
  const sortedCafes = useMemo(() => {
    return rankCafesForHome([...cafes], ratingsByCafeId, tasteProfile);
  }, [ratingsByCafeId, tasteProfile]);

  function goToSearchWithRank(rank: (typeof BROWSE_BY)[number]['rank']) {
    router.push({ pathname: '/search', params: { rank } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topSection}>
          <View style={styles.sectionIntro}>
            <Text style={styles.sectionTitle}>Top picks today</Text>
            <Text style={styles.sectionSubtitle}>Editor&apos;s pick for remote work</Text>
          </View>

          <View style={styles.browseBlock}>
            <Text style={styles.browseTitle}>Browse by</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.browseChipsRow}
            >
              {BROWSE_BY.map((item) => (
                <FilterChip
                  key={item.rank}
                  label={item.label}
                  onPress={() => goToSearchWithRank(item.rank)}
                />
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.testAuthButton}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.testAuthButtonText}>Test Auth</Text>
          </TouchableOpacity>

          {sortedCafes.map((cafe) => (
            <HomeCafeCard
              key={cafe.id}
              cafe={cafe}
              localRating={ratingsByCafeId[cafe.id]}
              recommendationReason={getRecommendationReason(cafe, tasteProfile)}
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
  sectionIntro: {
    gap: 2,
    marginTop: 0,
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
  browseBlock: {
    gap: 10,
    marginTop: -2,
  },
  browseTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2E2A27',
    letterSpacing: -0.2,
  },
  browseChipsRow: {
    gap: 8,
    paddingRight: 12,
    paddingBottom: 2,
  },
  testAuthButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#F2EBDD',
    borderWidth: 1,
    borderColor: '#E7DDCD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: -2,
    marginBottom: 2,
  },
  testAuthButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E2A27',
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
  featuredReason: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6E6254',
    fontWeight: '500',
    marginTop: 2,
  },
  featuredNeighborhood: {
    fontSize: 13,
    color: '#6E6254',
    lineHeight: 18,
  },
  ratedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(163, 177, 138, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(163, 177, 138, 0.45)',
    marginTop: -4,
  },
  ratedBadgeText: {
    fontSize: 12,
    color: '#4A5A49',
    fontWeight: '600',
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
