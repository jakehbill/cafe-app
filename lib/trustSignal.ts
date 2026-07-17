import type { Cafe } from '@/data/cafes';
import type { UserTasteProfile } from '@/lib/cafePersonalization';
import { publicCoffeeOutOf5ForCafe } from '@/lib/publicCoffeeDisplay';
import { getMatchesTopPicksTrustLabel } from '@/lib/recommendationReason';

/**
 * Extensible card trust signals (priority order).
 * Add new kinds here; cards only render `label` when non-null.
 */
export type TrustSignalKind =
  | 'matches_top_picks'
  | 'verified_by_workers'
  | 'featured_by_beaned'
  | 'recently_verified'
  | 'trending_this_week'
  | 'popular_with_founders'
  | 'great_for_deep_work';

export type TrustSignalResult = {
  kind: TrustSignalKind;
  label: string;
};

/** Community validation gates for “Verified by X remote workers”. */
export const TRUST_VERIFIED_MIN_REVIEWS = 5;
export const TRUST_VERIFIED_MIN_WORK_SCORE = 8;

export type ResolveTrustSignalInput = {
  cafe: Pick<Cafe, 'id' | 'publicCoffeeScore' | 'coffeeRatingCount' | 'isCertified'> &
    Partial<Pick<Cafe, 'coffeeScore' | 'workScore' | 'vibeScore' | 'tags'>>;
  /** From `buildTasteProfileFromState`; omit/null for public / logged-out. */
  tasteProfile?: UserTasteProfile | null;
};

function uniqueReviewCount(cafe: Pick<Cafe, 'coffeeRatingCount'>): number {
  const n = cafe.coffeeRatingCount;
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/**
 * Priority 2 — community validation from the workspace review model.
 * `coffeeRatingCount` is unique users (ratings upsert per user×space); post–Sprint 6
 * public scores only reflect the new 1–10 Work Score path.
 */
export function resolveVerifiedByWorkersSignal(
  cafe: Pick<Cafe, 'publicCoffeeScore' | 'coffeeRatingCount'>
): TrustSignalResult | null {
  const count = uniqueReviewCount(cafe);
  if (count < TRUST_VERIFIED_MIN_REVIEWS) return null;

  const score = publicCoffeeOutOf5ForCafe(cafe);
  if (score == null || score < TRUST_VERIFIED_MIN_WORK_SCORE) return null;

  return {
    kind: 'verified_by_workers',
    label: `Verified by ${count} remote workers`,
  };
}

/**
 * Resolve the single trust line for a card (or null).
 *
 * Priority:
 * 1. Matches your top picks (personal, high confidence)
 * 2. Verified by X remote workers (community)
 * 3. Nothing
 *
 * Future kinds can be inserted into this chain without changing card layout.
 */
export function resolveTrustSignal(input: ResolveTrustSignalInput): TrustSignalResult | null {
  const cafe = input.cafe as Cafe;
  const profile = input.tasteProfile ?? null;

  const personal = getMatchesTopPicksTrustLabel(cafe, profile);
  if (personal) {
    return { kind: 'matches_top_picks', label: personal };
  }

  const verified = resolveVerifiedByWorkersSignal(cafe);
  if (verified) return verified;

  return null;
}
