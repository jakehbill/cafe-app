import { resolveToCanonicalTagSlug } from '@/lib/tagRegistry';
import { quantizeCoffeeRatingForStorage } from '@/lib/coffeeRating';
import { supabase, upsertCoffeeRatingForUser } from '@/lib/supabase';

type SubmissionContributorRow = {
  user_id: string | null;
  notes: string | null;
  coffee_rating: number | null;
  selected_tags: string[] | null;
};

type VisitContributorRow = {
  id: string;
  note: string | null;
  rating: number | null;
  tags: string[] | null;
};

function normalizeSubmissionTags(raw: string[] | null | undefined): string[] {
  const slugs: string[] = [];
  for (const rawTag of raw ?? []) {
    const slug = resolveToCanonicalTagSlug(String(rawTag ?? '').trim());
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

function parseSubmissionCoffeeRating(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  return quantizeCoffeeRatingForStorage(raw);
}

/**
 * After a café is approved, copy the submitter’s Google Places extras into live UGC tables:
 * - `user_cafe_visits` (community notes on café detail)
 * - `ratings` + `rating_tags` (public score via `cafe_public_scores`)
 */
export async function promoteSubmitterContributionOnCafeApproval(params: {
  submissionId: string;
  cafeId: string;
}): Promise<void> {
  const submissionId = String(params.submissionId ?? '').trim();
  const cafeId = String(params.cafeId ?? '').trim();
  const cafeIdNum = Number.parseInt(cafeId, 10);
  if (!submissionId || !cafeId) return;

  const subRes = await supabase
    .from('cafe_submissions')
    .select('user_id, notes, coffee_rating, selected_tags')
    .eq('id', submissionId)
    .maybeSingle();

  if (subRes.error || !subRes.data) {
    console.warn(
      '[promoteSubmitterContributionOnCafeApproval] could not load submission:',
      subRes.error?.message ?? 'not found'
    );
    return;
  }

  const submission = subRes.data as SubmissionContributorRow;
  const submitterId = String(submission.user_id ?? '').trim();
  if (!submitterId) return;

  const submissionNote = String(submission.notes ?? '').trim();
  const submissionTags = normalizeSubmissionTags(submission.selected_tags);
  const submissionCoffee = parseSubmissionCoffeeRating(submission.coffee_rating);

  let visit: VisitContributorRow | null = null;

  const bySubmissionRes = await supabase
    .from('user_cafe_visits')
    .select('id, note, rating, tags')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!bySubmissionRes.error && bySubmissionRes.data) {
    visit = bySubmissionRes.data as VisitContributorRow;
  }

  if (!visit) {
    const byCafeRes = await supabase
      .from('user_cafe_visits')
      .select('id, note, rating, tags')
      .eq('cafe_id', cafeId)
      .eq('user_id', submitterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byCafeRes.error && byCafeRes.data) {
      visit = byCafeRes.data as VisitContributorRow;
    }
  }

  const visitNote = submissionNote || String(visit?.note ?? '').trim();
  const visitRating =
    submissionCoffee ??
    (typeof visit?.rating === 'number' && Number.isFinite(visit.rating) ? visit.rating : null);
  const visitTags =
    submissionTags.length > 0
      ? submissionTags
      : Array.isArray(visit?.tags)
        ? visit.tags.map((t) => String(t).trim()).filter(Boolean)
        : [];

  if (visit) {
    const updatePayload: {
      cafe_id: string;
      submission_id: null;
      note?: string;
      rating?: number | null;
      tags?: string[];
    } = {
      cafe_id: cafeId,
      submission_id: null,
    };
    if (submissionNote) updatePayload.note = submissionNote;
    if (submissionCoffee != null) updatePayload.rating = submissionCoffee;
    if (submissionTags.length > 0) updatePayload.tags = submissionTags;

    const updateRes = await supabase.from('user_cafe_visits').update(updatePayload).eq('id', visit.id);
    if (updateRes.error) {
      console.warn(
        '[promoteSubmitterContributionOnCafeApproval] visit update failed:',
        updateRes.error.message
      );
    }
  } else if (visitNote || visitRating != null || visitTags.length > 0) {
    const insertRes = await supabase.from('user_cafe_visits').insert({
      user_id: submitterId,
      cafe_id: cafeId,
      submission_id: null,
      note: visitNote,
      rating: visitRating,
      tags: visitTags,
    });
    if (insertRes.error) {
      console.warn(
        '[promoteSubmitterContributionOnCafeApproval] visit insert failed:',
        insertRes.error.message
      );
    }
  }

  const coffeeForRatings =
    visitRating ??
    (typeof visit?.rating === 'number' && Number.isFinite(visit.rating) ? visit.rating : null);

  if (coffeeForRatings != null && Number.isFinite(cafeIdNum)) {
    const ratingRes = await upsertCoffeeRatingForUser({
      userId: submitterId,
      cafeId: cafeIdNum,
      coffee: coffeeForRatings,
      tags: visitTags,
    });
    if (!ratingRes.ok) {
      console.warn(
        '[promoteSubmitterContributionOnCafeApproval] ratings upsert failed:',
        ratingRes.error
      );
    }
  }
}
