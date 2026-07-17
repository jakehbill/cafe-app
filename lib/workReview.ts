/**
 * Sprint 4 remote-work review fields (presentation + storage values).
 * Work Score (1–10) is separate — see `lib/coffeeRating.ts`.
 */

export const STAY_DURATION_OPTIONS = [
  { value: 'under_1h', label: 'Less than 1 hour' },
  { value: '1_2h', label: '1–2 hours' },
  { value: 'half_day', label: 'Half day' },
  { value: 'full_day', label: 'Full day' },
] as const;

export type StayDurationValue = (typeof STAY_DURATION_OPTIONS)[number]['value'];

export const COST_TO_WORK_OPTIONS = [
  { value: 'free', label: 'Free', display: 'Free' },
  { value: 'under_10', label: 'Under £10', display: 'Under £10' },
  { value: '10_20', label: '£10–20', display: '£10–20' },
  { value: '20_30', label: '£20–30', display: '£20–30' },
  { value: '30_plus', label: '£30+', display: '£30+' },
] as const;

export type CostToWorkValue = (typeof COST_TO_WORK_OPTIONS)[number]['value'];

/** Quality scales: Poor → Excellent (left → right). */
export const WIFI_RELIABILITY_OPTIONS = [
  { value: 'poor', label: 'Poor' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'excellent', label: 'Excellent' },
] as const;

export type WifiReliabilityValue = (typeof WIFI_RELIABILITY_OPTIONS)[number]['value'];

/**
 * “How easy was it to find a seat?” (Seat Availability)
 * Stored in `user_cafe_visits.busyness`.
 * Progresses Difficult → Plenty available (left → right).
 */
export const SEAT_FINDING_OPTIONS = [
  { value: 'difficult', label: 'Difficult' },
  { value: 'okay', label: 'Okay' },
  { value: 'easy', label: 'Easy' },
  { value: 'plenty', label: 'Plenty available' },
] as const;

export type SeatFindingValue = (typeof SEAT_FINDING_OPTIONS)[number]['value'];

/** @deprecated Use SeatFindingValue — same DB column. */
export type BusynessValue = SeatFindingValue;
/** @deprecated Use SEAT_FINDING_OPTIONS. */
export const BUSYNESS_OPTIONS = SEAT_FINDING_OPTIONS;

/** Same tap scale as Wi‑Fi for optional coffee/food quality. */
export const QUALITY_OPTIONS = WIFI_RELIABILITY_OPTIONS;
export type QualityValue = WifiReliabilityValue;

/**
 * Workspace tags shown in the review flow (multi-select).
 * Slugs match `tagRegistry` where possible so search/filters stay aligned.
 */
export const WORKSPACE_REVIEW_TAGS = [
  { slug: 'good_for_calls', label: 'Great for calls' },
  { slug: 'quiet', label: 'Quiet' },
  { slug: 'good_wifi', label: 'Fast Wi-Fi' },
  { slug: 'has_outlets', label: 'Lots of outlets' },
  { slug: 'comfortable_seating', label: 'Comfortable seating' },
  { slug: 'good_natural_light', label: 'Natural light' },
  { slug: 'long_stays_welcome', label: 'Long stays welcome' },
  { slug: 'spacious', label: 'Spacious tables' },
  { slug: 'good_food', label: 'Food available' },
  { slug: 'good_coffee', label: 'Good coffee' },
  { slug: 'air_conditioning', label: 'Air conditioning' },
  { slug: 'open_late', label: 'Open late' },
  { slug: 'friendly_staff', label: 'Friendly staff' },
] as const;

export type WorkspaceReviewTagSlug = (typeof WORKSPACE_REVIEW_TAGS)[number]['slug'];

export function formatCostToWorkDisplay(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const hit = COST_TO_WORK_OPTIONS.find((o) => o.value === v);
  return hit ? hit.display : null;
}

export function formatStayDurationLabel(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  return STAY_DURATION_OPTIONS.find((o) => o.value === v)?.label ?? null;
}

/** Community seat availability — friendly, decision-oriented. */
export function formatSeatAvailabilityLabel(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim();
  if (!isSeatFindingValue(v)) return null;
  switch (v) {
    case 'difficult':
      return 'Usually hard to find a seat';
    case 'okay':
      return 'Usually okay to find a seat';
    case 'easy':
      return 'Usually easy to find a seat';
    case 'plenty':
      return 'Usually easy to find a seat';
    default:
      return null;
  }
}

export function formatWifiReliabilityLabel(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim();
  if (!isWifiReliabilityValue(v)) return null;
  return WIFI_RELIABILITY_OPTIONS.find((o) => o.value === v)?.label ?? null;
}

export function formatQualityLabel(value: string | null | undefined): string | null {
  return formatWifiReliabilityLabel(value);
}

export function isStayDurationValue(raw: string): raw is StayDurationValue {
  return STAY_DURATION_OPTIONS.some((o) => o.value === raw);
}

export function isCostToWorkValue(raw: string): raw is CostToWorkValue {
  return COST_TO_WORK_OPTIONS.some((o) => o.value === raw);
}

export function isWifiReliabilityValue(raw: string): raw is WifiReliabilityValue {
  return WIFI_RELIABILITY_OPTIONS.some((o) => o.value === raw);
}

export function isSeatFindingValue(raw: string): raw is SeatFindingValue {
  return SEAT_FINDING_OPTIONS.some((o) => o.value === raw);
}

/** Accepts new seat-finding values; ignores legacy quiet/moderate/busy/packed. */
export function isBusynessValue(raw: string): raw is BusynessValue {
  return isSeatFindingValue(raw);
}

export function isQualityValue(raw: string): raw is QualityValue {
  return QUALITY_OPTIONS.some((o) => o.value === raw);
}
