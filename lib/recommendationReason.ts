import type { Cafe } from '@/data/cafes';
import type { UserTasteProfile } from '@/lib/cafePersonalization';

/**
 * One short line per cafe (no numbers). Priority:
 * A) Top visits / similarity to your ranked picks
 * B) Clear axis preference from ratings + visits blend
 * C) Tag match (Quiet / Specialty / Quick) from highly rated visits
 * D) Stable fallback
 *
 * Tweak thresholds and strings in `REASON_*` below.
 */

const REASON = {
  /** Ranks 1–3 in your visited list */
  matchesTopPicks: 'Matches your top picks',
  /** Cafe scores/tags align with your top visited cluster */
  similarToRankedHighly: 'Similar to spaces you ranked highly',

  workPreference: 'Matches your favourite work spots',
  coffeePreference: 'Fits your coffee standards',
  vibePreference: 'Aligned with your vibe preferences',

  quiet: 'Quiet spots you tend to like',
  specialty: 'Specialty Beans you usually go for',
  quick: 'Fast spots you often choose',

  fallbackA: 'Good all-round pick',
  fallbackB: 'Popular choice nearby',
} as const;

/** Top N visit ranks that count as “top picks” for copy */
const TOP_PICK_MAX_RANK = 3;

/** Min gap between strongest and second axis (0–10 scale) to claim a clear preference */
const DIMENSION_GAP = 0.35;

/** Similarity to reference visit cluster: normalized score dot product */
const SIMILARITY_DOT_MIN = 0.52;

/** Min reference-visit tag affinity on a matching cafe tag */
const MIN_REF_TAG_AFFINITY = 0.4;

/** Min affinity for tag-based lines (highly rated + merged) */
const MIN_TAG_AFFINITY = 0.42;

function normTag(t: string): string {
  return t.trim().toLowerCase();
}

/** Prefer tags learned from highly rated cafes; fall back to merged affinity */
function tagAffinityForReason(profile: UserTasteProfile, key: string): number {
  return Math.max(profile.highRatingTagAffinity[key] ?? 0, profile.tagAffinity[key] ?? 0);
}

/**
 * Same idea as ranking’s reference similarity: dot product in 0–1 space, plus overlap
 * with tags from your top visited listings.
 */
function isSimilarToTopVisitedCluster(cafe: Cafe, profile: UserTasteProfile): boolean {
  if (!profile.referenceScores) {
    return false;
  }
  const r = profile.referenceScores;
  const rc = r.coffee / 10;
  const rw = r.work / 10;
  const rv = r.vibe / 10;
  const cc = cafe.coffeeScore / 10;
  const cw = cafe.workScore / 10;
  const cv = cafe.vibeScore / 10;
  const dot = rc * cc + rw * cw + rv * cv;
  if (dot >= SIMILARITY_DOT_MIN) {
    return true;
  }
  for (const t of cafe.tags) {
    const k = normTag(t);
    const a = profile.referenceTagAffinity[k];
    if (a !== undefined && a >= MIN_REF_TAG_AFFINITY) {
      return true;
    }
  }
  return false;
}

/**
 * A) Ranked visits first: literal top picks, then similarity to the same cluster.
 */
function rankedVisitedReason(cafe: Cafe, profile: UserTasteProfile): string | null {
  const rank = profile.visitedRankByCafeId[cafe.id];
  if (rank !== undefined && rank <= TOP_PICK_MAX_RANK) {
    return REASON.matchesTopPicks;
  }
  if (isSimilarToTopVisitedCluster(cafe, profile)) {
    return REASON.similarToRankedHighly;
  }
  return null;
}

/**
 * B) One dominant axis in blended averages (ratings + reference visits).
 */
function ratingPreferenceReason(profile: UserTasteProfile): string | null {
  const rows = [
    { avg: profile.avgWork, line: REASON.workPreference },
    { avg: profile.avgCoffee, line: REASON.coffeePreference },
    { avg: profile.avgVibe, line: REASON.vibePreference },
  ];
  rows.sort((a, b) => b.avg - a.avg);
  if (rows[0].avg - rows[1].avg < DIMENSION_GAP) {
    return null;
  }
  return rows[0].line;
}

/**
 * C) Tag rules — cafe must carry the tag; user affinity from highly rated visits (and merge).
 */
const TAG_RULES: ReadonlyArray<{
  cafeHas: (cafe: Cafe) => boolean;
  affinity: (profile: UserTasteProfile, cafe: Cafe) => number;
  line: string;
}> = [
  {
    cafeHas: (cafe) => cafe.tags.some((t) => normTag(t) === 'quiet'),
    affinity: (p) => tagAffinityForReason(p, 'quiet'),
    line: REASON.quiet,
  },
  {
    cafeHas: (cafe) => cafe.tags.some((t) => normTag(t).includes('specialty')),
    affinity: (p, cafe) => {
      let best = 0;
      for (const t of cafe.tags) {
        const k = normTag(t);
        if (k.includes('specialty')) {
          best = Math.max(best, tagAffinityForReason(p, k));
        }
      }
      return best;
    },
    line: REASON.specialty,
  },
  {
    cafeHas: (cafe) =>
      cafe.tags.some((t) => {
        const n = normTag(t);
        return n === 'quick' || n === 'fast service';
      }),
    affinity: (p) =>
      Math.max(tagAffinityForReason(p, 'quick'), tagAffinityForReason(p, 'fast service')),
    line: REASON.quick,
  },
];

function highlyRatedTagReason(cafe: Cafe, profile: UserTasteProfile): string | null {
  for (const rule of TAG_RULES) {
    if (!rule.cafeHas(cafe)) {
      continue;
    }
    if (rule.affinity(profile, cafe) >= MIN_TAG_AFFINITY) {
      return rule.line;
    }
  }
  return null;
}

/** D) Stable choice between two fallbacks */
function fallbackReason(cafe: Cafe): string {
  const n = Number.parseInt(cafe.id, 10);
  const idx = Number.isFinite(n) ? Math.abs(n) % 2 : cafe.id.charCodeAt(0) % 2;
  return idx === 0 ? REASON.fallbackA : REASON.fallbackB;
}

/**
 * @param profile — from `buildTasteProfileFromState`; `null` if nothing to personalize from.
 */
export function getRecommendationReason(cafe: Cafe, profile: UserTasteProfile | null): string {
  if (profile === null) {
    return fallbackReason(cafe);
  }

  const a = rankedVisitedReason(cafe, profile);
  if (a !== null) {
    return a;
  }

  const b = ratingPreferenceReason(profile);
  if (b !== null) {
    return b;
  }

  const c = highlyRatedTagReason(cafe, profile);
  if (c !== null) {
    return c;
  }

  return fallbackReason(cafe);
}
