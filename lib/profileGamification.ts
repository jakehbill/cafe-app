import type { CafeRating } from '@/contexts/CafeStateContext';

/**
 * Unified points model (single progression source for levels + badges).
 * - Rating a cafe = 20 pts (one row in `user_cafe_ratings`)
 * - Marking visited = 10 pts per visited cafe
 * - Saving = 5 pts per saved cafe
 * - Each tag on a rating = 2 pts (from `user_cafe_ratings.tags`)
 */
export const POINTS = {
  perRating: 20,
  perVisited: 10,
  perSaved: 5,
  perTag: 2,
} as const;

export type ActivitySnapshot = {
  savedCount: number;
  visitedCount: number;
  ratingsCount: number;
  /** Sum of tag selections across all ratings (each tag counts once). */
  tagCount: number;
  /** |saved cafe ids ∪ visited cafe ids| — for the Cafe Scout badge. */
  savedVisitedUnionCount: number;
  /**
   * True when some cafe is saved, visited, and rated (proxy for “house favourite”;
   * the DB does not record repeat visits to the same cafe).
   */
  hasTripleEngagementCafe: boolean;
};

export function countTagsInRatings(ratingsByCafeId: Record<string, CafeRating>): number {
  let n = 0;
  for (const r of Object.values(ratingsByCafeId)) {
    n += r.tags.length;
  }
  return n;
}

export function computeSavedVisitedUnionCount(savedIds: string[], visitedIds: string[]): number {
  return new Set([...savedIds, ...visitedIds]).size;
}

/** At least one cafe appears in saved, visited, and ratings. */
export function hasCafeSavedVisitedAndRated(
  savedIds: string[],
  visitedIds: string[],
  ratingsByCafeId: Record<string, CafeRating>
): boolean {
  const saved = new Set(savedIds);
  const visited = new Set(visitedIds);
  for (const id of visited) {
    if (saved.has(id) && ratingsByCafeId[id] != null) {
      return true;
    }
  }
  return false;
}

export function computeTotalPoints(snapshot: ActivitySnapshot): number {
  return (
    snapshot.ratingsCount * POINTS.perRating +
    snapshot.visitedCount * POINTS.perVisited +
    snapshot.savedCount * POINTS.perSaved +
    snapshot.tagCount * POINTS.perTag
  );
}

/**
 * Level thresholds (minimum total points inclusive).
 * 0 → Newcomer, 100 → First Pour, …, 1400 → Cult Favourite (max).
 */
const LEVEL_TIERS = [
  { minPoints: 0, title: 'Newcomer' },
  { minPoints: 100, title: 'First Pour' },
  { minPoints: 250, title: 'Regular' },
  { minPoints: 500, title: 'Explorer' },
  { minPoints: 900, title: 'Connoisseur' },
  { minPoints: 1400, title: 'Cult Favourite' },
] as const;

export type LevelProgress = {
  currentTitle: string;
  nextTitle: string | null;
  nextTierMinPoints: number | null;
  /** Progress within the current tier toward the next (0–1). */
  progress01: number;
  pointsToNext: number;
  isMaxLevel: boolean;
};

export function getLevelProgress(totalPoints: number): LevelProgress {
  const lastIdx = LEVEL_TIERS.length - 1;
  const maxTier = LEVEL_TIERS[lastIdx];

  if (totalPoints >= maxTier.minPoints) {
    return {
      currentTitle: maxTier.title,
      nextTitle: null,
      nextTierMinPoints: null,
      progress01: 1,
      pointsToNext: 0,
      isMaxLevel: true,
    };
  }

  let tierIndex = 0;
  for (let i = lastIdx; i >= 0; i--) {
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
  /** Short line shown under the name on the profile grid (display only). */
  description: string;
  icon: string;
  unlocked: boolean;
};

/** Milestone badges — unlock rules use the same `ActivitySnapshot` as points. */
export function computeProfileBadges(snapshot: ActivitySnapshot): ProfileBadge[] {
  const catalog: ProfileBadge[] = [
    {
      id: 'first-sip',
      label: 'First Sip',
      description: 'Rated your first cafe',
      icon: '○',
      unlocked: snapshot.ratingsCount >= 1,
    },
    {
      id: 'dialled-in',
      label: 'Dialled In',
      description: 'Rated 5 cafes',
      icon: '◉',
      unlocked: snapshot.ratingsCount >= 5,
    },
    {
      id: 'shot-caller',
      label: 'Shot Caller',
      description: 'Rated 10 cafes',
      icon: '★',
      unlocked: snapshot.ratingsCount >= 10,
    },
    {
      id: 'tasting-notes',
      label: 'Tasting Notes',
      description: 'Added 10 tags across cafes',
      icon: '✎',
      unlocked: snapshot.tagCount >= 10,
    },
    {
      id: 'cafe-scout',
      label: 'Cafe Scout',
      description: 'Saved or visited 10 cafes',
      icon: '△',
      unlocked: snapshot.savedVisitedUnionCount >= 10,
    },
    {
      id: 'house-favourite',
      label: 'House Favourite',
      description: 'Visited the same cafe 3 times',
      icon: '♥',
      unlocked: snapshot.hasTripleEngagementCafe,
    },
  ];

  return [...catalog].sort((a, b) => {
    if (a.unlocked === b.unlocked) {
      return catalog.indexOf(a) - catalog.indexOf(b);
    }
    return a.unlocked ? -1 : 1;
  });
}
