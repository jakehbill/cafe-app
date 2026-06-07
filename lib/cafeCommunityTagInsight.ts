import { formatTagLabel } from '@/lib/cafeTags';

/** Minimum distinct taggers before showing a percentage. */
export const TAG_INSIGHT_MIN_USERS_FOR_PERCENT = 3;

export type CafeCommunityTagInsight = {
  tag: string;
  /** Distinct users who selected this tag on a visit. */
  mentionCount: number;
  /** Distinct users who logged at least one tag for this café. */
  totalTaggedUsers: number;
  /** Distinct visits with at least one tag (informational). */
  totalTaggedVisits: number;
  /** Rounded 0–100 when sample size supports it; otherwise null. */
  percent: number | null;
};

export function formatCafeCommunityTagInsight(insight: CafeCommunityTagInsight): string {
  const label = formatTagLabel(insight.tag);
  const { mentionCount, totalTaggedUsers, percent } = insight;

  if (mentionCount <= 0 || totalTaggedUsers <= 0) {
    return 'Community picks will appear here once more people tag this cafe.';
  }

  if (totalTaggedUsers === 1 && mentionCount === 1) {
    return `1 person mentioned ${label}`;
  }

  if (totalTaggedUsers < TAG_INSIGHT_MIN_USERS_FOR_PERCENT) {
    const n = mentionCount;
    return `${n} ${n === 1 ? 'person' : 'people'} mentioned ${label}`;
  }

  if (percent != null && percent > 0) {
    return `${percent}% mentioned ${label}`;
  }

  const n = mentionCount;
  return `${n} ${n === 1 ? 'person' : 'people'} mentioned ${label}`;
}

export function buildCafeCommunityTagInsightFromCounts(params: {
  tag: string;
  mentionCount: number;
  totalTaggedUsers: number;
  totalTaggedVisits: number;
}): CafeCommunityTagInsight | null {
  const mentionCount = Math.max(0, Math.floor(params.mentionCount));
  const totalTaggedUsers = Math.max(0, Math.floor(params.totalTaggedUsers));
  const totalTaggedVisits = Math.max(0, Math.floor(params.totalTaggedVisits));
  const tag = String(params.tag ?? '').trim();
  if (!tag || mentionCount <= 0 || totalTaggedUsers <= 0) return null;

  const rawPercent = Math.round((mentionCount / totalTaggedUsers) * 100);
  const percent =
    totalTaggedUsers >= TAG_INSIGHT_MIN_USERS_FOR_PERCENT
      ? Math.min(100, Math.max(0, rawPercent))
      : null;

  return {
    tag,
    mentionCount,
    totalTaggedUsers,
    totalTaggedVisits,
    percent,
  };
}
