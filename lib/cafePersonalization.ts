import type { CafeRating } from '@/contexts/CafeStateContext';
import type { Cafe } from '@/data/cafes';

/**
 * Built from the signed-in user's `user_cafe_ratings` rows (via `ratingsByCafeId`).
 *
 * - Averages: simple means of coffee / work / vibe across all rated cafes.
 * - Tags: weighted counts from (a) tags on each rating and (b) cafe tags for that visit,
 *   weighted higher when the user’s composite score for that cafe is higher (“liked” visits).
 * - `tagAffinity`: each tag normalized by the strongest tag so scores stay 0..1.
 */
export type UserTasteProfile = {
  avgCoffee: number;
  avgWork: number;
  avgVibe: number;
  /** Lowercased tag strings, top 3–5 by weighted frequency */
  topTags: string[];
  /** Lowercased tag → affinity 0..1 */
  tagAffinity: Record<string, number>;
};

function normTag(t: string): string {
  return t.trim().toLowerCase();
}

/** Composite 1–10 for one rating visit */
function composite(r: CafeRating): number {
  return (r.coffee + r.work + r.vibe) / 3;
}

/**
 * How much this visit contributes to tag learning: higher when the user rated the cafe well.
 * Range ~0.15–1 so low ratings still contribute a little (taste signal) but highs dominate.
 */
function visitWeight(r: CafeRating): number {
  const c = composite(r);
  return 0.15 + (Math.max(0, c - 1) / 9) * 0.85;
}

const TOP_TAG_COUNT = 5;

/**
 * Returns `null` when there are no ratings → callers skip personalization entirely.
 */
export function buildUserTasteProfile(
  ratingsByCafeId: Record<string, CafeRating>,
  cafesById: Record<string, Cafe>
): UserTasteProfile | null {
  const entries = Object.entries(ratingsByCafeId);
  if (entries.length === 0) {
    return null;
  }

  let sumCoffee = 0;
  let sumWork = 0;
  let sumVibe = 0;
  const tagWeights: Record<string, number> = {};

  for (const [cafeId, rating] of entries) {
    sumCoffee += rating.coffee;
    sumWork += rating.work;
    sumVibe += rating.vibe;

    const w = visitWeight(rating);

    for (const t of rating.tags) {
      const k = normTag(t);
      if (k) {
        tagWeights[k] = (tagWeights[k] ?? 0) + w;
      }
    }

    const cafe = cafesById[cafeId];
    if (cafe) {
      for (const t of cafe.tags) {
        const k = normTag(t);
        if (k) {
          tagWeights[k] = (tagWeights[k] ?? 0) + w * 0.65;
        }
      }
    }
  }

  const n = entries.length;
  const avgCoffee = sumCoffee / n;
  const avgWork = sumWork / n;
  const avgVibe = sumVibe / n;

  const sorted = Object.entries(tagWeights).sort((a, b) => b[1] - a[1]);
  const topSlice = sorted.slice(0, TOP_TAG_COUNT);
  const maxW = topSlice[0]?.[1] ?? 1;

  const tagAffinity: Record<string, number> = {};
  for (const [tag, w] of Object.entries(tagWeights)) {
    tagAffinity[tag] = maxW > 0 ? w / maxW : 0;
  }

  const topTags = topSlice.map(([tag]) => tag);

  return {
    avgCoffee,
    avgWork,
    avgVibe,
    topTags,
    tagAffinity,
  };
}

/**
 * Subtle add-on to base ranking (same units as other score components — tweak `PERSONALIZE`).
 *
 * Score similarity: dot product of user’s average axis preferences (0–1) with cafe scores (0–1).
 * Higher user avg on a dimension → stronger pull toward cafes that score high there.
 *
 * Tag similarity: sum affinities for each cafe tag (overlaps with tags you gravitated to on liked visits).
 */
const PERSONALIZE = {
  /** Weight for score-alignment term (typical contribution ~3–12) */
  scoreScale: 5,
  /** Weight for tag overlap (typical contribution ~0–4) */
  tagScale: 3,
  /** Cap on tag contribution so one rare tag doesn’t dominate */
  tagSumCap: 4,
} as const;

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
    const a = profile.tagAffinity[k];
    if (a !== undefined) {
      tagSum += a;
    }
  }
  const tagOverlap = Math.min(tagSum, PERSONALIZE.tagSumCap);

  return scoreAlignment * PERSONALIZE.scoreScale + tagOverlap * PERSONALIZE.tagScale;
}

/** Exported for tuning documentation; adjust these to change how strong personalization feels */
export const PERSONALIZE_WEIGHTS = PERSONALIZE;
