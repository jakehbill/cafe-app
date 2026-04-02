import type { CafeRating } from '@/contexts/CafeStateContext';
import type { Cafe } from '@/data/cafes';

/**
 * Personalization profile for ranking (see `personalizationBoost`).
 *
 * Tuning: `PERSONALIZE_WEIGHTS` and tier constants below.
 *
 * Priority of signals (strongest → weakest):
 * 1) Ranked visited — per-cafe tier boost + reference “similar taste” from top visits
 * 2) Ratings — axis alignment + tags (extra weight for tags from highly-rated visits, composite ≥ 8)
 * 3) Saved — small uniform boost when the cafe is bookmarked
 */
export type UserTasteProfile = {
  avgCoffee: number;
  avgWork: number;
  avgVibe: number;
  /** Lowercased tag strings, top 5 by weighted frequency (merged signals) */
  topTags: string[];
  /** Lowercased tag → affinity 0..1 (merged for UI / tag lines) */
  tagAffinity: Record<string, number>;
  /** Rating-derived tag affinities only (ranking; avoids double-counting with high/reference terms) */
  baseTagAffinity: Record<string, number>;
  /** 1-based rank for cafes the user has visited (ordered list from Supabase) */
  visitedRankByCafeId: Record<string, number>;
  savedCafeIds: Set<string>;
  /** Centroid scores from top visited cafes (for similarity); null if no visits */
  referenceScores: { coffee: number; work: number; vibe: number } | null;
  /** Tag affinities learned only from highly-rated cafes (composite ≥ 8) */
  highRatingTagAffinity: Record<string, number>;
  /** Tag affinities from top-N visited cafe listings (reference for “similar taste”) */
  referenceTagAffinity: Record<string, number>;
  /** Raw coffee average from user ratings (for subtle negative signal); null if no ratings */
  rawRatingAverages: { coffee: number } | null;
  ratingCount: number;
};

function normTag(t: string): string {
  return t.trim().toLowerCase();
}

/** Strength of one user rating (1–10) for tag learning */
function composite(r: CafeRating): number {
  return r.coffee;
}

const HIGH_RATING_THRESHOLD = 8;

/**
 * How much this visit contributes to tag learning: higher when the user rated the cafe well.
 * Range ~0.15–1 so low ratings still contribute a little (taste signal) but highs dominate.
 */
function visitWeight(r: CafeRating): number {
  const c = composite(r);
  return 0.15 + (Math.max(0, c - 1) / 9) * 0.85;
}

const TOP_TAG_COUNT = 5;
const REFERENCE_VISIT_DEPTH = 5;

/** Per-cafe boost by visit rank tier (stable additive points) */
const VISIT_RANK_BOOST = {
  strong: 24,
  medium: 15,
  light: 8,
} as const;

const SAVED_CAFE_BOOST = 4;

/** Blend reference visited vs rating averages for axis preferences (visited weighted higher) */
const BLEND_REFERENCE = 0.58;
const BLEND_RATINGS = 0.42;

/**
 * Returns `null` when there is no saved / visited / rating data to personalize from.
 */
export function buildUserTasteProfile(
  ratingsByCafeId: Record<string, CafeRating>,
  cafesById: Record<string, Cafe>,
  visitedCafeIdsOrdered: string[],
  savedCafeIds: string[]
): UserTasteProfile | null {
  const ratingEntries = Object.entries(ratingsByCafeId);
  const hasRatings = ratingEntries.length > 0;
  const hasVisited = visitedCafeIdsOrdered.length > 0;
  const hasSaved = savedCafeIds.length > 0;

  if (!hasRatings && !hasVisited && !hasSaved) {
    return null;
  }

  const visitedRankByCafeId: Record<string, number> = {};
  visitedCafeIdsOrdered.forEach((id, i) => {
    visitedRankByCafeId[id] = i + 1;
  });

  const referenceSlice = visitedCafeIdsOrdered.slice(0, REFERENCE_VISIT_DEPTH);
  let refCoffee = 0;
  let refWork = 0;
  let refVibe = 0;
  let refCount = 0;
  const referenceTagWeights: Record<string, number> = {};

  for (let i = 0; i < referenceSlice.length; i++) {
    const id = referenceSlice[i];
    const cafe = cafesById[id];
    if (!cafe) continue;
    refCount += 1;
    refCoffee += cafe.coffeeScore;
    refWork += cafe.workScore;
    refVibe += cafe.vibeScore;
    const rank = i + 1;
    const positionWeight = Math.max(0.35, (REFERENCE_VISIT_DEPTH - rank + 1) / REFERENCE_VISIT_DEPTH);
    for (const t of cafe.tags) {
      const k = normTag(t);
      if (k) {
        referenceTagWeights[k] = (referenceTagWeights[k] ?? 0) + positionWeight;
      }
    }
  }

  const referenceScores =
    refCount > 0
      ? {
          coffee: refCoffee / refCount,
          work: refWork / refCount,
          vibe: refVibe / refCount,
        }
      : null;

  let sumCoffee = 0;
  const tagWeights: Record<string, number> = {};
  const highRatingTagWeights: Record<string, number> = {};

  for (const [cafeId, rating] of ratingEntries) {
    sumCoffee += rating.coffee;

    const w = visitWeight(rating);
    const isHigh = composite(rating) >= HIGH_RATING_THRESHOLD;
    const highW = isHigh ? w * 1.35 : 0;

    for (const t of rating.tags) {
      const k = normTag(t);
      if (k) {
        tagWeights[k] = (tagWeights[k] ?? 0) + w;
        if (isHigh) {
          highRatingTagWeights[k] = (highRatingTagWeights[k] ?? 0) + highW;
        }
      }
    }

    const cafe = cafesById[cafeId];
    if (cafe) {
      for (const t of cafe.tags) {
        const k = normTag(t);
        if (k) {
          tagWeights[k] = (tagWeights[k] ?? 0) + w * 0.65;
          if (isHigh) {
            highRatingTagWeights[k] = (highRatingTagWeights[k] ?? 0) + highW * 0.65;
          }
        }
      }
    }
  }

  const n = ratingEntries.length;
  const rawRatingAverages = hasRatings ? { coffee: sumCoffee / n } : null;

  let avgCoffee: number;
  let avgWork: number;
  let avgVibe: number;

  if (referenceScores && hasRatings) {
    avgCoffee = BLEND_REFERENCE * referenceScores.coffee + BLEND_RATINGS * (sumCoffee / n);
    avgWork = referenceScores.work;
    avgVibe = referenceScores.vibe;
  } else if (referenceScores) {
    avgCoffee = referenceScores.coffee;
    avgWork = referenceScores.work;
    avgVibe = referenceScores.vibe;
  } else if (hasRatings) {
    avgCoffee = sumCoffee / n;
    avgWork = 5;
    avgVibe = 5;
  } else {
    avgCoffee = 5;
    avgWork = 5;
    avgVibe = 5;
  }

  const normalizeAffinity = (weights: Record<string, number>) => {
    const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
    const topSlice = sorted.slice(0, TOP_TAG_COUNT);
    const maxW = topSlice[0]?.[1] ?? 1;
    const aff: Record<string, number> = {};
    for (const [tag, w] of Object.entries(weights)) {
      aff[tag] = maxW > 0 ? w / maxW : 0;
    }
    return aff;
  };

  const baseTagAffinity = normalizeAffinity(tagWeights);
  const highRatingTagAffinity = normalizeAffinity(highRatingTagWeights);
  const referenceTagAffinity = normalizeAffinity(referenceTagWeights);

  const mergedForTop: Record<string, number> = { ...tagWeights };
  for (const [k, v] of Object.entries(highRatingTagWeights)) {
    mergedForTop[k] = (mergedForTop[k] ?? 0) + v * 1.1;
  }
  for (const [k, v] of Object.entries(referenceTagWeights)) {
    mergedForTop[k] = (mergedForTop[k] ?? 0) + v * 1.15;
  }

  const sortedMerged = Object.entries(mergedForTop).sort((a, b) => b[1] - a[1]);
  const topTags = sortedMerged.slice(0, TOP_TAG_COUNT).map(([tag]) => tag);

  const tagAffinity: Record<string, number> = {};
  const maxMerged = sortedMerged[0]?.[1] ?? 1;
  for (const [tag, w] of Object.entries(mergedForTop)) {
    tagAffinity[tag] = maxMerged > 0 ? w / maxMerged : 0;
  }

  return {
    avgCoffee,
    avgWork,
    avgVibe,
    topTags,
    tagAffinity,
    baseTagAffinity,
    visitedRankByCafeId,
    savedCafeIds: new Set(savedCafeIds),
    referenceScores,
    highRatingTagAffinity,
    referenceTagAffinity,
    rawRatingAverages,
    ratingCount: n,
  };
}

/**
 * Add-on to base search rank (same units as other score components).
 *
 * - Ranked visit boost: fixed tier by 1-based rank (strongest personalization).
 * - Saved boost: small constant for bookmarked cafes.
 * - Score alignment: blended user preferences × cafe scores (stronger than before).
 * - Tag overlap: general + high-rating tags + reference-visited tags (capped).
 * - Negative: if user’s raw average on an axis is low, slightly down-rank cafes very strong on that axis.
 */
const PERSONALIZE = {
  /** Weight for score-alignment term (dot product in 0–1 space) */
  scoreScale: 8,
  /** Weight for general tag overlap */
  tagScale: 4,
  /** Extra weight for tags from highly-rated visits (≥8 composite) */
  highRatingTagScale: 5,
  /** Extra weight for tags from top visited reference cafes */
  referenceTagScale: 6,
  /** Cap on combined tag contribution */
  tagSumCap: 6,
  /** Extra dot product vs reference centroid (top visits); kept moderate to avoid double-counting with blended avg) */
  referenceSimilarityScale: 2,
  /** Min ratings before applying subtle negative axis penalty */
  minRatingsForNegative: 2,
  /** Below this raw average on an axis → can apply light penalty */
  lowAxisThreshold: 3.6,
  /** Max magnitude of negative term per axis (subtle) */
  negativeAxisMax: 2.8,
} as const;

function visitedRankTierBoost(rank: number): number {
  if (rank <= 3) return VISIT_RANK_BOOST.strong;
  if (rank <= 6) return VISIT_RANK_BOOST.medium;
  return VISIT_RANK_BOOST.light;
}

/**
 * Subtle: only when user has several ratings and is clearly “low” on an axis.
 */
function negativeAxisPenalty(
  profile: UserTasteProfile,
  scores: { coffee: number; work: number; vibe: number }
): number {
  const raw = profile.rawRatingAverages;
  if (!raw || profile.ratingCount < PERSONALIZE.minRatingsForNegative) {
    return 0;
  }

  let penalty = 0;
  if (raw.coffee < PERSONALIZE.lowAxisThreshold) {
    const low = (PERSONALIZE.lowAxisThreshold - raw.coffee) / PERSONALIZE.lowAxisThreshold;
    penalty -= PERSONALIZE.negativeAxisMax * low * (scores.coffee / 10);
  }

  return penalty;
}

function referenceSimilarityExtra(
  profile: UserTasteProfile,
  scores: { coffee: number; work: number; vibe: number }
): number {
  if (!profile.referenceScores) return 0;
  const r = profile.referenceScores;
  const rc = r.coffee / 10;
  const rw = r.work / 10;
  const rv = r.vibe / 10;
  const cc = scores.coffee / 10;
  const cw = scores.work / 10;
  const cv = scores.vibe / 10;
  return (rc * cc + rw * cw + rv * cv) * PERSONALIZE.referenceSimilarityScale;
}

export function personalizationBoost(
  cafe: Cafe,
  profile: UserTasteProfile,
  scores: { coffee: number; work: number; vibe: number }
): number {
  const uc = profile.avgCoffee / 10;
  const uw = profile.avgWork / 10;
  const uv = profile.avgVibe / 10;
  const cc = scores.coffee / 10;
  const cw = scores.work / 10;
  const cv = scores.vibe / 10;

  const scoreAlignment = uc * cc + uw * cw + uv * cv;

  let tagSum = 0;
  for (const t of cafe.tags) {
    const k = normTag(t);
    const g = profile.baseTagAffinity[k];
    if (g !== undefined) {
      tagSum += g * PERSONALIZE.tagScale;
    }
    const h = profile.highRatingTagAffinity[k];
    if (h !== undefined) {
      tagSum += h * PERSONALIZE.highRatingTagScale;
    }
    const r = profile.referenceTagAffinity[k];
    if (r !== undefined) {
      tagSum += r * PERSONALIZE.referenceTagScale;
    }
  }

  const tagOverlap = Math.min(tagSum, PERSONALIZE.tagSumCap);

  let boost =
    scoreAlignment * PERSONALIZE.scoreScale +
    tagOverlap +
    referenceSimilarityExtra(profile, scores) +
    negativeAxisPenalty(profile, scores);

  const rank = profile.visitedRankByCafeId[cafe.id];
  if (rank !== undefined) {
    boost += visitedRankTierBoost(rank);
  }

  if (profile.savedCafeIds.has(cafe.id)) {
    boost += SAVED_CAFE_BOOST;
  }

  return boost;
}

/** Tier boosts for ranked visits (additive points) */
export const VISIT_RANK_BOOST_WEIGHTS = VISIT_RANK_BOOST;

/** Saved-cafe bump */
export const SAVED_BOOST_POINTS = SAVED_CAFE_BOOST;

/** Exported for tuning documentation */
export const PERSONALIZE_WEIGHTS = PERSONALIZE;
