import type { Cafe } from '@/data/cafes';
import type { UserTasteProfile } from '@/lib/cafePersonalization';

/**
 * One human line explaining why we surfaced this cafe. Priority:
 * 1) Score — user clearly favors coffee / work / vibe in past ratings
 * 2) Tag — cafe has a tag you often picked on highly-rated visits (affinity)
 * 3) Fallback — generic copy (no numbers)
 *
 * Tweak: DIMENSION_GAP, MIN_TAG_AFFINITY, MESSAGES, FALLBACKS, tag checks below.
 */

const DIMENSION_GAP = 0.35;

/** Min normalized tag affinity (0–1) to show a tag-based line */
const MIN_TAG_AFFINITY = 0.42;

const MESSAGES = {
  work: 'Great match for your work spots',
  coffee: 'Matches your love for great coffee',
  vibe: 'Fits your vibe preferences',
} as const;

const FALLBACKS = ['Popular with similar users', 'Good all-round pick'] as const;

function normTag(t: string): string {
  return t.trim().toLowerCase();
}

/** Stable pick so lists don’t shuffle between the two fallbacks */
function fallbackLine(cafe: Cafe): string {
  const n = Number.parseInt(cafe.id, 10);
  const idx = Number.isFinite(n) ? Math.abs(n) % FALLBACKS.length : cafe.id.charCodeAt(0) % FALLBACKS.length;
  return FALLBACKS[idx];
}

function scorePreferenceLine(profile: UserTasteProfile): string | null {
  const rows = [
    { avg: profile.avgWork, line: MESSAGES.work },
    { avg: profile.avgCoffee, line: MESSAGES.coffee },
    { avg: profile.avgVibe, line: MESSAGES.vibe },
  ];
  rows.sort((a, b) => b.avg - a.avg);
  if (rows[0].avg - rows[1].avg < DIMENSION_GAP) {
    return null;
  }
  return rows[0].line;
}

/**
 * Tag lines in display priority (first match wins).
 * Each entry: test cafe tags, affinity key(s) on profile, copy.
 */
const TAG_RULES: ReadonlyArray<{
  cafeHas: (cafe: Cafe) => boolean;
  affinity: (profile: UserTasteProfile, cafe: Cafe) => number;
  line: string;
}> = [
  {
    cafeHas: (cafe) => cafe.tags.some((t) => normTag(t) === 'quiet'),
    affinity: (p) => p.tagAffinity['quiet'] ?? 0,
    line: 'Quiet spots you usually enjoy',
  },
  {
    cafeHas: (cafe) => cafe.tags.some((t) => normTag(t).includes('specialty')),
    affinity: (p, cafe) => {
      let best = 0;
      for (const t of cafe.tags) {
        const k = normTag(t);
        if (k.includes('specialty')) {
          best = Math.max(best, p.tagAffinity[k] ?? 0);
        }
      }
      return best;
    },
    line: 'Specialty coffee you tend to like',
  },
  {
    cafeHas: (cafe) =>
      cafe.tags.some((t) => {
        const n = normTag(t);
        return n === 'quick' || n === 'fast service';
      }),
    affinity: (p) => Math.max(p.tagAffinity['quick'] ?? 0, p.tagAffinity['fast service'] ?? 0),
    line: 'Fast spots you often go for',
  },
];

function tagLine(cafe: Cafe, profile: UserTasteProfile): string | null {
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

/**
 * @param profile — from `buildUserTasteProfile` / `buildTasteProfileFromState`; `null` if no ratings.
 */
export function getRecommendationReason(cafe: Cafe, profile: UserTasteProfile | null): string {
  if (profile === null) {
    return fallbackLine(cafe);
  }

  const fromScores = scorePreferenceLine(profile);
  if (fromScores !== null) {
    return fromScores;
  }

  const fromTags = tagLine(cafe, profile);
  if (fromTags !== null) {
    return fromTags;
  }

  return fallbackLine(cafe);
}
