import type { CafeRating } from '@/contexts/CafeStateContext';

/**
 * Unified points model (single progression source for levels + badges).
 * Computed from activity counts on profile load — not stored in the database.
 *
 * - Log / visit (unique cafe) = 1 pt
 * - Rate a cafe (`user_cafe_ratings` row) = 1 pt
 * - Save a cafe = 1 pt
 * - Tags on ratings = 0 pts (covered by rating; avoids tag inflation)
 * - Suggest a cafe = 2 pts (one per meaningful submission key)
 * - Cafe approved = 5 pts
 * - Submit a photo = 1 pt
 * - Photo approved = 1 pt
 */
export const POINTS = {
  perRating: 1,
  perVisited: 1,
  perSaved: 1,
  perTag: 0,
  perCafeSuggestion: 2,
  perCafeApproved: 5,
  perPhotoSubmitted: 1,
  perPhotoApproved: 1,
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
  cafesSuggestedCount: number;
  cafesApprovedCount: number;
  photosSubmittedCount: number;
  photosApprovedCount: number;
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
    snapshot.tagCount * POINTS.perTag +
    snapshot.cafesSuggestedCount * POINTS.perCafeSuggestion +
    snapshot.cafesApprovedCount * POINTS.perCafeApproved +
    snapshot.photosSubmittedCount * POINTS.perPhotoSubmitted +
    snapshot.photosApprovedCount * POINTS.perPhotoApproved
  );
}

/**
 * Level thresholds (minimum total points inclusive).
 * Tight early tiers for long-term, Duolingo-style progression.
 */
const LEVEL_TIERS = [
  { minPoints: 0, title: 'First Sip' },
  { minPoints: 10, title: 'Regular' },
  { minPoints: 25, title: 'Café Hopper' },
  { minPoints: 45, title: 'Neighbourhood Explorer' },
  { minPoints: 70, title: 'Flat White Finder' },
  { minPoints: 100, title: 'Hidden Gem Hunter' },
  { minPoints: 140, title: 'Coffee Cartographer' },
  { minPoints: 190, title: 'City Sipper' },
  { minPoints: 250, title: 'Beaned Local' },
  { minPoints: 325, title: 'Café Legend' },
  { minPoints: 425, title: 'Beaned Legend' },
  { minPoints: 540, title: 'Coffee Elder' },
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

export type LevelTierEntry = {
  /** 1-based level number */
  level: number;
  title: string;
  minPoints: number;
  unlocked: boolean;
  isCurrent: boolean;
};

/** All Beaned levels with unlock/current flags derived from total points. */
export function getLevelTierEntries(totalPoints: number): LevelTierEntry[] {
  const safePoints =
    typeof totalPoints === 'number' && Number.isFinite(totalPoints) ? Math.max(0, totalPoints) : 0;
  const currentLevel = getUserLevel(safePoints);
  return LEVEL_TIERS.map((tier, index) => ({
    level: index + 1,
    title: tier.title,
    minPoints: tier.minPoints,
    unlocked: index + 1 <= currentLevel,
    isCurrent: index + 1 === currentLevel,
  }));
}

export function getUserLevel(totalPoints: number | null | undefined): number {
  const safePoints =
    typeof totalPoints === 'number' && Number.isFinite(totalPoints) ? Math.max(0, totalPoints) : 0;
  let tierIndex = 0;
  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (safePoints >= LEVEL_TIERS[i].minPoints) {
      tierIndex = i;
      break;
    }
  }
  return tierIndex + 1;
}

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

/** Milestone badges — unlock rules use activity counts, not point totals. */
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
    {
      id: 'first-cafe-approved',
      label: 'Greenlit Cafe',
      description: 'First cafe suggestion approved',
      icon: '✓',
      unlocked: snapshot.cafesApprovedCount >= 1,
    },
    {
      id: 'multiple-cafes-approved',
      label: 'Curator',
      description: '3 cafe suggestions approved',
      icon: '☕',
      unlocked: snapshot.cafesApprovedCount >= 3,
    },
    {
      id: 'first-photo-approved',
      label: 'Lens Approved',
      description: 'First photo approved',
      icon: '◍',
      unlocked: snapshot.photosApprovedCount >= 1,
    },
    {
      id: 'multiple-photos-approved',
      label: 'Photo Regular',
      description: '5 photos approved',
      icon: '▣',
      unlocked: snapshot.photosApprovedCount >= 5,
    },
  ];

  return [...catalog].sort((a, b) => {
    if (a.unlocked === b.unlocked) {
      return catalog.indexOf(a) - catalog.indexOf(b);
    }
    return a.unlocked ? -1 : 1;
  });
}
