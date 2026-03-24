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

/** How many ratings must include a “Quiet” tag to earn the badge */
const QUIET_BADGE_MIN_RATINGS = 3;

function quietTaggedRatingCount(ratingsByCafeId: Record<string, CafeRating>): number {
  let n = 0;
  for (const r of Object.values(ratingsByCafeId)) {
    if (r.tags.some((t) => t.toLowerCase().includes('quiet'))) {
      n += 1;
    }
  }
  return n;
}

/**
 * Badge rules (tweak thresholds / copy here).
 * Unlocked when the condition is true using the same counts as points + rating tags from context.
 */
export function computeProfileBadges(
  counts: ActivityCounts,
  ratingsByCafeId: Record<string, CafeRating>
): ProfileBadge[] {
  const quietN = quietTaggedRatingCount(ratingsByCafeId);

  return [
    {
      id: 'first-save',
      label: 'First Save',
      icon: '☆',
      unlocked: counts.saved >= 1,
    },
    {
      id: 'first-review',
      label: 'First Review',
      icon: '✎',
      unlocked: counts.ratings >= 1,
    },
    {
      id: 'visit-5',
      label: '5 Cafes Visited',
      icon: '◎',
      unlocked: counts.visited >= 5,
    },
    {
      id: 'rate-10',
      label: '10 Ratings',
      icon: '★',
      unlocked: counts.ratings >= 10,
    },
    {
      id: 'quiet-finder',
      label: 'Quiet Spot Finder',
      icon: '◇',
      unlocked: quietN >= QUIET_BADGE_MIN_RATINGS,
    },
  ];
}
