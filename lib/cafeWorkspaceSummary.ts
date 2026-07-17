/**
 * Community workspace review aggregates (modes from user_cafe_visits).
 */

import type { Cafe } from '@/data/cafes';
import { supabase } from '@/lib/supabase';
import {
  formatCostToWorkDisplay,
  formatQualityLabel,
  formatSeatAvailabilityLabel,
  formatStayDurationLabel,
  formatWifiReliabilityLabel,
  isCostToWorkValue,
  isQualityValue,
  isSeatFindingValue,
  isStayDurationValue,
  isWifiReliabilityValue,
  type CostToWorkValue,
  type QualityValue,
  type SeatFindingValue,
  type StayDurationValue,
  type WifiReliabilityValue,
} from '@/lib/workReview';

export type CafeWorkspaceSummary = {
  stayDuration: StayDurationValue | null;
  costToWork: CostToWorkValue | null;
  seatFinding: SeatFindingValue | null;
  wifiReliability: WifiReliabilityValue | null;
  coffeeQuality: QualityValue | null;
  foodQuality: QualityValue | null;
};

export const EMPTY_WORKSPACE_SUMMARY: CafeWorkspaceSummary = {
  stayDuration: null,
  costToWork: null,
  seatFinding: null,
  wifiReliability: null,
  coffeeQuality: null,
  foodQuality: null,
};

function parseSummaryRow(row: Record<string, unknown>): CafeWorkspaceSummary {
  const stay = String(row.stay_duration ?? '').trim();
  const cost = String(row.cost_to_work ?? '').trim();
  const seat = String(row.busyness ?? '').trim();
  const wifi = String(row.wifi_reliability ?? '').trim();
  const coffee = String(row.coffee_quality ?? '').trim();
  const food = String(row.food_quality ?? '').trim();
  return {
    stayDuration: isStayDurationValue(stay) ? stay : null,
    costToWork: isCostToWorkValue(cost) ? cost : null,
    seatFinding: isSeatFindingValue(seat) ? seat : null,
    wifiReliability: isWifiReliabilityValue(wifi) ? wifi : null,
    coffeeQuality: isQualityValue(coffee) ? coffee : null,
    foodQuality: isQualityValue(food) ? food : null,
  };
}

/**
 * Batch community modes for list cards / catalog hydrate.
 * Requires `get_cafes_workspace_review_summaries` (Sprint 5 SQL).
 */
export async function fetchCafeWorkspaceSummariesForIds(
  ids: string[]
): Promise<Map<string, CafeWorkspaceSummary>> {
  const unique = Array.from(new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean)));
  const out = new Map<string, CafeWorkspaceSummary>();
  if (unique.length === 0) return out;

  const rpc = await supabase.rpc('get_cafes_workspace_review_summaries', {
    p_cafe_ids: unique,
  });
  if (rpc.error) {
    if (__DEV__) {
      console.warn(
        '[workspace summary] batch RPC unavailable — deploy supabase/launch_workspace_card_hydration.sql:',
        rpc.error.message
      );
    }
    return out;
  }

  for (const raw of rpc.data ?? []) {
    const row = raw as Record<string, unknown>;
    const cafeId = String(row.cafe_id ?? '').trim();
    if (!cafeId) continue;
    out.set(cafeId, parseSummaryRow(row));
  }
  return out;
}

export async function fetchCafeWorkspaceSummaryForId(
  cafeId: string
): Promise<CafeWorkspaceSummary | null> {
  const id = String(cafeId ?? '').trim();
  if (!id) return null;
  const map = await fetchCafeWorkspaceSummariesForIds([id]);
  return map.get(id) ?? { ...EMPTY_WORKSPACE_SUMMARY };
}

export function mergeWorkspaceSummaryIntoCafe(
  cafe: Cafe,
  summary: CafeWorkspaceSummary | null | undefined
): Cafe {
  if (!summary) return cafe;
  const hasAny =
    summary.stayDuration ||
    summary.costToWork ||
    summary.seatFinding ||
    summary.wifiReliability ||
    summary.coffeeQuality ||
    summary.foodQuality;
  if (!hasAny) return { ...cafe, workspaceSummary: undefined };
  return { ...cafe, workspaceSummary: summary };
}

export async function hydrateCafesWithWorkspaceSummaries(cafes: Cafe[]): Promise<Cafe[]> {
  if (cafes.length === 0) return [];
  const map = await fetchCafeWorkspaceSummariesForIds(cafes.map((c) => c.id));
  return cafes.map((cafe) => mergeWorkspaceSummaryIntoCafe(cafe, map.get(cafe.id) ?? null));
}

/** Card meta — typical session + cost only (omit empties). Seat/wifi stay on detail. */
export function buildWorkspaceCardFactParts(cafe: Pick<Cafe, 'workspaceSummary'>): string[] {
  const s = cafe.workspaceSummary;
  if (!s) return [];
  const parts: string[] = [];
  const session = formatStayDurationLabel(s.stayDuration);
  if (session) parts.push(session);
  const cost = formatCostToWorkDisplay(s.costToWork);
  if (cost) parts.push(cost);
  return parts;
}

/** Detail facts — friendly language, no raw DB values. */
export function buildWorkspaceDetailFacts(cafe: Pick<Cafe, 'workspaceSummary'>): {
  workSession: string | null;
  costToWork: string | null;
  seatFinding: string | null;
  wifi: string | null;
  coffee: string | null;
  food: string | null;
} {
  const s = cafe.workspaceSummary;
  if (!s) {
    return {
      workSession: null,
      costToWork: null,
      seatFinding: null,
      wifi: null,
      coffee: null,
      food: null,
    };
  }
  return {
    workSession: formatStayDurationLabel(s.stayDuration),
    costToWork: formatCostToWorkDisplay(s.costToWork),
    seatFinding: formatSeatAvailabilityLabel(s.seatFinding),
    wifi: formatWifiReliabilityLabel(s.wifiReliability),
    coffee: formatQualityLabel(s.coffeeQuality),
    food: formatQualityLabel(s.foodQuality),
  };
}
