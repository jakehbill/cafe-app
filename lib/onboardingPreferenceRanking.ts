import type { Cafe } from '@/data/cafes';

import {
  COFFEE_PREFERENCE_OPTIONS,
  INTENT_PREFERENCE_OPTIONS,
  VIBE_PREFERENCE_OPTIONS,
} from '@/lib/profile';

/**
 * Soft ranking signal from onboarding (`public.profiles`).
 *
 * Strength vs behavior-driven personalization (`personalizationBoost` in `cafePersonalization.ts`):
 * - Visit tier boosts alone are 8–24 pts; saved bump is 4; tag overlap from real behavior is capped ~6+ with larger per-tag weights.
 * - This layer is capped at `ONBOARDING_RANK_MAX` (~6) per cafe so it cannot reorder lists ahead of strong behavioral signals.
 */

/** Max total points from onboarding per cafe (same units as other rank add-ons). */
export const ONBOARDING_RANK_MAX = 6;

const TAG_MATCH_WEIGHT = 1.15;
/** Cap on points accumulated from tag slug matches (before axis nudge). */
const TAG_MATCH_SUM_CAP = 4.25;

const AXIS_NUDGE_MAX = 1.75;

function normTag(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Cafe tags may be slugs (`great_espresso`) or labels; compare in normalized slug form. */
function cafeHasTagSlug(cafe: Cafe, slug: string): boolean {
  const want = normTag(slug);
  return cafe.tags.some((t) => normTag(t) === want);
}

export type OnboardingPreferenceRankInput = {
  coffee_preference: string | null;
  vibe_preferences: string[] | null;
  intent_preferences: string[] | null;
};

/** Maps onboarding coffee step → community tag slugs (`lib/cafeTags`). */
const COFFEE_PREF_TO_SLUGS: Record<(typeof COFFEE_PREFERENCE_OPTIONS)[number], string[]> = {
  'Espresso-based (latte, cappuccino, flat white)': ['great_espresso', 'specialty_coffee'],
  'Filter / pour-over': ['great_filter', 'specialty_coffee'],
  'Iced drinks': ['specialty_coffee', 'quick_stop'],
  'I care more about the space': ['aesthetic', 'cosy', 'spacious'],
};

const VIBE_TO_SLUGS: Record<(typeof VIBE_PREFERENCE_OPTIONS)[number], string[]> = {
  'Minimal / clean': ['aesthetic', 'spacious'],
  'Cosy / warm': ['cosy'],
  'Busy / buzzy': ['busy'],
  'Quiet / calm': ['quiet'],
};

const INTENT_TO_SLUGS: Record<(typeof INTENT_PREFERENCE_OPTIONS)[number], string[]> = {
  'A good place to work': ['good_for_working', 'good_wifi', 'has_outlets', 'quiet'],
  'Great coffee first': ['great_espresso', 'great_filter', 'specialty_coffee'],
  'Catching up with friends': ['cosy', 'brunch_spot', 'aesthetic', 'busy'],
  'Quiet solo time': ['quiet'],
  'A bit of everything': ['specialty_coffee', 'good_for_working', 'cosy'],
};

function collectSlugs(prefs: OnboardingPreferenceRankInput): Set<string> {
  const out = new Set<string>();

  if (prefs.coffee_preference) {
    const key = prefs.coffee_preference as keyof typeof COFFEE_PREF_TO_SLUGS;
    const list = COFFEE_PREF_TO_SLUGS[key];
    if (list) {
      for (const s of list) out.add(s);
    }
  }

  for (const v of prefs.vibe_preferences ?? []) {
    const key = v as keyof typeof VIBE_TO_SLUGS;
    const list = VIBE_TO_SLUGS[key];
    if (list) {
      for (const s of list) out.add(s);
    }
  }

  for (const intent of prefs.intent_preferences ?? []) {
    const key = intent as keyof typeof INTENT_TO_SLUGS;
    const list = INTENT_TO_SLUGS[key];
    if (list) {
      for (const s of list) out.add(s);
    }
  }

  return out;
}

/**
 * Tiny axis alignment from onboarding wording (not tag-based), bounded so it stays “soft”.
 */
function axisNudgeFromPreferences(cafe: Cafe, prefs: OnboardingPreferenceRankInput): number {
  let n = 0;
  const coffee = prefs.coffee_preference ?? '';

  if (coffee.includes('Espresso') || coffee.includes('pour-over') || coffee.includes('Filter')) {
    n += (cafe.coffeeScore / 10) * 0.55;
  }
  if (coffee.includes('Iced')) {
    n += (cafe.coffeeScore / 10) * 0.35;
  }
  if (coffee.includes('space')) {
    n += (cafe.vibeScore / 10) * 0.5;
  }

  for (const v of prefs.vibe_preferences ?? []) {
    if (v.includes('Quiet') || v.includes('calm')) {
      n += (cafe.vibeScore / 10) * 0.25;
    }
    if (v.includes('Busy') || v.includes('buzzy')) {
      n += (cafe.vibeScore / 10) * 0.2;
    }
  }

  for (const intent of prefs.intent_preferences ?? []) {
    if (intent.includes('work')) {
      n += (cafe.workScore / 10) * 0.55;
    }
    if (intent.includes('coffee first')) {
      n += (cafe.coffeeScore / 10) * 0.55;
    }
    if (intent.includes('friends')) {
      n += (cafe.vibeScore / 10) * 0.35;
    }
    if (intent.includes('Quiet solo')) {
      n += (cafe.vibeScore / 10) * 0.3;
    }
    if (intent.includes('everything')) {
      n += ((cafe.coffeeScore + cafe.workScore + cafe.vibeScore) / 30) * 0.25;
    }
  }

  return Math.min(n, AXIS_NUDGE_MAX);
}

/**
 * Additive boost from onboarding preferences (tags + small score nudge), capped globally.
 */
export function computeOnboardingPreferenceBoost(
  cafe: Cafe,
  prefs: OnboardingPreferenceRankInput | null
): number {
  if (!prefs) {
    return 0;
  }

  const slugs = collectSlugs(prefs);
  if (slugs.size === 0) {
    return Math.min(axisNudgeFromPreferences(cafe, prefs), ONBOARDING_RANK_MAX);
  }

  let matchPts = 0;
  for (const slug of slugs) {
    if (cafeHasTagSlug(cafe, slug)) {
      matchPts += TAG_MATCH_WEIGHT;
    }
  }
  matchPts = Math.min(matchPts, TAG_MATCH_SUM_CAP);

  const axis = axisNudgeFromPreferences(cafe, prefs);
  return Math.min(matchPts + axis, ONBOARDING_RANK_MAX);
}
