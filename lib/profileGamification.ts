import type { CafeRating } from '@/contexts/CafeStateContext';

/**
 * Points (tweak here):
 * - Each saved cafe = 1
 * - Each visited cafe = 2
 * - Each rating submitted = 5
 */
export const POINTS = {
  perSaved: 1,
  perVisited: 2,
  perRating: 5,
} as const;

export type ActivityCounts = {
  saved: number;
  visited: number;
  ratings: number;
};

export function computeActivityPoints(c: ActivityCounts): number {
  return c.saved * POINTS.perSaved + c.visited * POINTS.perVisited + c.ratings * POINTS.perRating;
}

/**
 * Level thresholds by minimum points (inclusive):
 * 0–9 Explorer, 10–24 Scout, 25–49 Workspace Scout, 50–99 Coffee Connoisseur, 100+ Local Legend
 */
const LEVEL_TIERS = [
  { minPoints: 0, title: 'Explorer' },
  { minPoints: 10, title: 'Scout' },
  { minPoints: 25, title: 'Workspace Scout' },
  { minPoints: 50, title: 'Coffee Connoisseur' },
  { minPoints: 100, title: 'Local Legend' },
] as const;

export type LevelProgress = {
  currentTitle: string;
  /** Next tier title, or null at max */
  nextTitle: string | null;
  /** Minimum points to enter the next tier (shown as “pts / next”); null at max */
  nextTierMinPoints: number | null;
  /** Progress within current tier toward the next (0–1) */
  progress01: number;
  /** Points still needed to reach the next tier (0 if max) */
  pointsToNext: number;
  isMaxLevel: boolean;
};

export function getLevelProgress(totalPoints: number): LevelProgress {
  if (totalPoints >= 100) {
    return {
      currentTitle: 'Local Legend',
      nextTitle: null,
      nextTierMinPoints: null,
      progress01: 1,
      pointsToNext: 0,
      isMaxLevel: true,
    };
  }

  let tierIndex = 0;
  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (totalPoints >= LEVEL_TIERS[i].minPoints) {
      tierIndex = i;
      break;
    }
  }

  const current = LEVEL_TIERS[tierIndex];
  const next = LEVEL_TIERS[tierIndex + 1];
  const span = next.minPoints - current.minPoints;
  const progress01 = span > 0 ? (totalPoints - current.minPoints) / span : 1;
  const pointsToNext = next.minPoints - totalPoints;

  return {
    currentTitle: current.title,
    nextTitle: next.title,
    nextTierMinPoints: next.minPoints,
    progress01: Math.min(1, Math.max(0, progress01)),
    pointsToNext,
    isMaxLevel: false,
  };
}

export type ProfileBadge = {
  id: string;
  label: string;
  icon: string;
  unlocked: boolean;
};

/**
 * Tune badge difficulty here (counts + coffee-only `ratingsByCafeId`; “Work Mode” / “Vibe Curator” use tag/elite-coffee heuristics).
 */
export const BADGE_THRESHOLDS = {
  /** Coffee score must be ≥ this (1–10) for “Coffee Standards” */
  highDimensionScore: 8,
  /** How many high-coffee ratings unlock “Coffee Standards” */
  minHighDimensionRatings: 5,
  /** “Vibe Curator” — count of ratings at or above elite coffee */
  eliteCoffeeScore: 9,
  /** Min ratings at elite coffee for that badge */
  minEliteCoffeeRatings: 3,
  /** Visited count for “Regular” */
  visitRegular: 5,
  /** Visited count for “Explorer” (badge name; separate from level title) */
  visitExplorer: 10,
  /** Total ratings for “Local Scout” */
  ratingsLocalScout: 10,
  /** Ratings where user picked a Quiet-related tag */
  quietTagSelections: 3,
} as const;

function countRatingsCoffeeAtOrAbove(
  ratingsByCafeId: Record<string, CafeRating>,
  minScore: number
): number {
  let n = 0;
  for (const r of Object.values(ratingsByCafeId)) {
    if (r.coffee >= minScore) {
      n += 1;
    }
  }
  return n;
}

function countRatingsWithAtLeastTags(
  ratingsByCafeId: Record<string, CafeRating>,
  minTags: number
): number {
  let n = 0;
  for (const r of Object.values(ratingsByCafeId)) {
    if (r.tags.length >= minTags) {
      n += 1;
    }
  }
  return n;
}

function quietTaggedRatingCount(ratingsByCafeId: Record<string, CafeRating>): number {
  let n = 0;
  for (const r of Object.values(ratingsByCafeId)) {
    if (r.tags.some((t) => t.toLowerCase().includes('quiet'))) {
      n += 1;
    }
  }
  return n;
}

/** Foundation → Activity → Taste → Advanced → Optional (stable catalog order). */
export function computeProfileBadges(
  counts: ActivityCounts,
  ratingsByCafeId: Record<string, CafeRating>
): ProfileBadge[] {
  const hi = BADGE_THRESHOLDS.highDimensionScore;
  const elite = BADGE_THRESHOLDS.eliteCoffeeScore;
  const tagRichRatings = countRatingsWithAtLeastTags(ratingsByCafeId, 2);
  const highCoffee = countRatingsCoffeeAtOrAbove(ratingsByCafeId, hi);
  const eliteCoffee = countRatingsCoffeeAtOrAbove(ratingsByCafeId, elite);
  const quietN = quietTaggedRatingCount(ratingsByCafeId);
  const minHi = BADGE_THRESHOLDS.minHighDimensionRatings;
  const minElite = BADGE_THRESHOLDS.minEliteCoffeeRatings;

  const catalog: ProfileBadge[] = [
    {
      id: 'first-sip',
      label: 'First Sip',
      icon: '○',
      unlocked: counts.saved >= 1,
    },
    {
      id: 'first-impression',
      label: 'First Impression',
      icon: '◐',
      unlocked: counts.ratings >= 1,
    },
    {
      id: 'regular',
      label: 'Regular',
      icon: '◎',
      unlocked: counts.visited >= BADGE_THRESHOLDS.visitRegular,
    },
    {
      id: 'explorer-visit',
      label: 'Explorer',
      icon: '△',
      unlocked: counts.visited >= BADGE_THRESHOLDS.visitExplorer,
    },
    {
      id: 'work-mode',
      label: 'Work Mode',
      icon: '▪',
      unlocked: tagRichRatings >= minHi,
    },
    {
      id: 'coffee-standards',
      label: 'Coffee Standards',
      icon: '●',
      unlocked: highCoffee >= minHi,
    },
    {
      id: 'vibe-curator',
      label: 'Vibe Curator',
      icon: '◆',
      unlocked: eliteCoffee >= minElite,
    },
    {
      id: 'local-scout',
      label: 'Local Scout',
      icon: '★',
      unlocked: counts.ratings >= BADGE_THRESHOLDS.ratingsLocalScout,
    },
    {
      id: 'quiet-finder',
      label: 'Quiet Finder',
      icon: '◇',
      unlocked: quietN >= BADGE_THRESHOLDS.quietTagSelections,
    },
  ];

  return [...catalog].sort((a, b) => {
    if (a.unlocked === b.unlocked) {
      return catalog.indexOf(a) - catalog.indexOf(b);
    }
    return a.unlocked ? -1 : 1;
  });
}
