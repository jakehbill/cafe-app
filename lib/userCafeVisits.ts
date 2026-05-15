import { normalizeCoffeeRatingInput } from '@/lib/coffeeRating';
import { rateCafe, supabase, type SupabaseActionResult } from '@/lib/supabase';
import { uploadCafePhotoAssetToStorage } from '@/lib/cafePhotoSubmissions';

type VisitPhotoAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export type UserCafeVisit = {
  id: string;
  cafeId: string | null;
  submissionId: string | null;
  submissionCafeName: string | null;
  submissionStatus: 'pending' | 'approved' | 'rejected' | null;
  createdAt: string;
  rating: number | null;
  tags: string[];
  note: string;
  isPublic: boolean;
  imageUrl: string | null;
};

type SaveVisitInput = {
  cafeId?: string | null;
  submissionId?: string | null;
  rating?: number | null;
  tags?: string[];
  note?: string;
  photoAsset?: VisitPhotoAsset | null;
};

async function buildSignedUrl(storagePath: string | null): Promise<string | null> {
  const path = String(storagePath ?? '').trim();
  if (!path) return null;
  const signed = await supabase.storage
    .from('cafe-user-photos')
    .createSignedUrl(path, 60 * 20);
  if (signed.error) return null;
  return signed.data?.signedUrl ?? null;
}

type VisitPhotoRow = {
  visit_id: string;
  storage_path: string | null;
  sort_order: number | null;
  is_public: boolean | null;
  public_status: string | null;
};

async function fetchPrimaryPhotoUrlByVisitId(visitIds: string[]): Promise<Map<string, string>> {
  if (visitIds.length === 0) return new Map();
  const res = await supabase
    .from('visit_photos')
    .select('visit_id, storage_path, sort_order, is_public, public_status')
    .in('visit_id', visitIds);
  if (res.error) return new Map();
  const rows = (res.data ?? []) as VisitPhotoRow[];
  rows.sort((a, b) => {
    const ao = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bo = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });

  const out = new Map<string, string>();
  for (const row of rows) {
    const visitId = String(row.visit_id ?? '').trim();
    if (!visitId || out.has(visitId)) continue;
    const url = await buildSignedUrl(row.storage_path ?? null);
    if (url) out.set(visitId, url);
  }
  return out;
}

async function insertVisitPhoto(params: {
  visitId: string;
  userId: string;
  storagePath: string;
}) {
  const current = await supabase
    .from('visit_photos')
    .select('sort_order')
    .eq('visit_id', params.visitId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort =
    !current.error && typeof current.data?.sort_order === 'number' ? current.data.sort_order + 1 : 0;

  const insertRes = await supabase.from('visit_photos').insert({
    visit_id: params.visitId,
    user_id: params.userId,
    storage_path: params.storagePath,
    sort_order: nextSort,
    is_public: false,
    public_status: 'private',
  });
  if (insertRes.error) {
    throw new Error(`Failed to save visit photo: ${insertRes.error.message}`);
  }
}

async function ensureSubmissionPhotoFromVisit(params: {
  submissionId: string;
  userId: string;
  storagePath: string;
}) {
  const existing = await supabase
    .from('cafe_submission_photos')
    .select('id')
    .eq('submission_id', params.submissionId)
    .eq('storage_path', params.storagePath)
    .limit(1);
  if (!existing.error && (existing.data?.length ?? 0) > 0) return;
  const countRes = await supabase
    .from('cafe_submission_photos')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', params.submissionId);
  if (countRes.error) {
    throw new Error(`Failed to prepare submission photo queue row: ${countRes.error.message}`);
  }
  const nextSort = countRes.count ?? 0;
  const insertRes = await supabase.from('cafe_submission_photos').insert({
    submission_id: params.submissionId,
    user_id: params.userId,
    storage_path: params.storagePath,
    image_url: null,
    photo_kind: 'other',
    sort_order: nextSort,
  });
  if (insertRes.error) {
    throw new Error(`Failed to queue photo for submission moderation: ${insertRes.error.message}`);
  }
}

async function getLatestVisitPhotoStoragePath(visitId: string): Promise<string | null> {
  const res = await supabase
    .from('visit_photos')
    .select('storage_path, sort_order')
    .eq('visit_id', visitId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) return null;
  const path = String(res.data?.storage_path ?? '').trim();
  return path || null;
}

async function ensureLegacyVisitedRow(params: { userId: string; cafeId: string }) {
  const existing = await supabase
    .from('user_visited_cafes')
    .select('cafe_id')
    .eq('user_id', params.userId)
    .eq('cafe_id', params.cafeId)
    .maybeSingle();
  if (existing.error) return;
  if (existing.data) return;

  const rankRes = await supabase
    .from('user_visited_cafes')
    .select('cafe_id', { count: 'exact', head: true })
    .eq('user_id', params.userId);
  const nextRank = (rankRes.count ?? 0) + 1;

  await supabase.from('user_visited_cafes').insert({
    user_id: params.userId,
    cafe_id: params.cafeId,
    rank_position: nextRank,
  });
}

async function removeSavedCafeIfExists(params: { userId: string; cafeId: string }) {
  await supabase.from('user_saved_cafes').delete().eq('user_id', params.userId).eq('cafe_id', params.cafeId);
}

async function queueVisitPhotoForModeration(params: {
  visitId: string;
  userId: string;
  cafeId: string;
  storagePath: string;
  note: string;
}) {
  const numericCafeId = Number(params.cafeId);
  if (!Number.isFinite(numericCafeId)) return;
  const existing = await supabase
    .from('cafe_photos')
    .select('id')
    .eq('cafe_id', numericCafeId)
    .eq('storage_path', params.storagePath)
    .limit(1);
  if (!existing.error && (existing.data?.length ?? 0) > 0) return;
  const insertRes = await supabase.from('cafe_photos').insert({
    user_id: params.userId,
    cafe_id: numericCafeId,
    storage_path: params.storagePath,
    image_url: null,
    caption: params.note.length > 0 ? params.note.slice(0, 280) : null,
    source_visit_id: params.visitId,
    status: 'pending',
  });
  if (insertRes.error) {
    throw new Error(`Failed to queue photo for cafe moderation: ${insertRes.error.message}`);
  }
}

async function removeVisitFromPendingPublicPool(visitId: string) {
  await supabase.from('cafe_photos').delete().eq('source_visit_id', visitId).eq('status', 'pending');
}

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
}

async function detectRapidDuplicate(params: {
  userId: string;
  cafeId: string;
  submissionId: string;
  rating: number | null;
  tags: string[];
  note: string;
}) {
  const recent = await supabase
    .from('user_cafe_visits')
    .select('id, created_at, rating, tags, note')
    .eq('user_id', params.userId)
    .or(
      params.cafeId
        ? `cafe_id.eq.${params.cafeId}`
        : params.submissionId
          ? `submission_id.eq.${params.submissionId}`
          : 'id.is.null'
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent.error || !recent.data) return false;
  const createdAt = Date.parse(String(recent.data.created_at ?? ''));
  if (!Number.isFinite(createdAt)) return false;
  if (Date.now() - createdAt > 15 * 1000) return false;
  const sameRating = (recent.data.rating ?? null) === params.rating;
  const sameNote = String(recent.data.note ?? '').trim() === params.note;
  const prevTags = Array.isArray(recent.data.tags) ? recent.data.tags.map(String) : [];
  const sameTags = prevTags.join('|') === params.tags.join('|');
  return sameRating && sameNote && sameTags;
}

export async function saveUserCafeVisit(input: SaveVisitInput): Promise<SupabaseActionResult> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { ok: false, error: error.message };
  const userId = data.user?.id;
  if (!userId) return { ok: false, error: 'You must be signed in to log a visit.' };

  const cafeId = String(input.cafeId ?? '').trim();
  const submissionId = String(input.submissionId ?? '').trim();
  if (!cafeId && !submissionId) {
    return { ok: false, error: 'A cafe or submission id is required.' };
  }

  const rating = normalizeCoffeeRatingInput(input.rating);
  const tags = normalizeTags(input.tags);
  const note = String(input.note ?? '').trim();

  const isRapidDuplicate = await detectRapidDuplicate({
    userId,
    cafeId,
    submissionId,
    rating,
    tags,
    note,
  });
  if (isRapidDuplicate) {
    return { ok: false, error: 'This looks like a duplicate visit. Please wait a moment and try again.' };
  }

  let storagePath: string | null = null;
  if (input.photoAsset?.uri) {
    const upload = await uploadCafePhotoAssetToStorage({
      userId,
      cafeId: cafeId || `submission-${submissionId}`,
      asset: input.photoAsset,
    });
    if (!upload.ok) return upload;
    storagePath = upload.storagePath;
  }

  const insertVisit = await supabase
    .from('user_cafe_visits')
    .insert({
      user_id: userId,
      cafe_id: cafeId || null,
      submission_id: submissionId || null,
      rating,
      tags,
      note,
    })
    .select('id')
    .single();
  if (insertVisit.error) return { ok: false, error: insertVisit.error.message };
  const visitId = String(insertVisit.data.id);

  if (cafeId) {
    await ensureLegacyVisitedRow({ userId, cafeId });
    await removeSavedCafeIfExists({ userId, cafeId });
  }

  try {
    if (storagePath) {
      await insertVisitPhoto({
        visitId,
        userId,
        storagePath,
      });
    }

    if (storagePath && cafeId) {
      await queueVisitPhotoForModeration({
        visitId,
        userId,
        cafeId,
        storagePath,
        note,
      });
    }

    if (storagePath && submissionId) {
      await ensureSubmissionPhotoFromVisit({
        submissionId,
        userId,
        storagePath,
      });
    }

    if (rating != null && cafeId) {
      const rateRes = await rateCafe(cafeId, {
        coffee: rating,
        tags,
        notes: note,
      });
      if (!rateRes.ok) {
        return {
          ok: false,
          error: `Visit saved, but rating sync failed: ${rateRes.error}`,
        };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moderation routing failed.';
    console.error('[saveUserCafeVisit] moderation routing failed', {
      visitId,
      cafeId: cafeId || null,
      submissionId: submissionId || null,
      storagePath,
      message,
    });
    return { ok: false, error: `Visit saved, but moderation routing failed: ${message}` };
  }

  return { ok: true };
}

export async function getUserCafeVisitById(visitId: string): Promise<UserCafeVisit | null> {
  const key = String(visitId).trim();
  if (!key) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  const res = await supabase
    .from('user_cafe_visits')
    .select(
      'id, cafe_id, submission_id, created_at, rating, tags, note, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('id', key)
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (res.error || !res.data) return null;
  const row = res.data;
  const imageMap = await fetchPrimaryPhotoUrlByVisitId([String(row.id)]);
  return {
    id: String(row.id),
    cafeId: row.cafe_id == null ? null : String(row.cafe_id),
    submissionId: row.submission_id == null ? null : String(row.submission_id),
    submissionCafeName:
      row.cafe_submissions && typeof row.cafe_submissions === 'object'
        ? String((row.cafe_submissions as { cafe_name?: unknown }).cafe_name ?? '').trim() || null
        : null,
    submissionStatus:
      row.cafe_submissions && typeof row.cafe_submissions === 'object'
        ? (((row.cafe_submissions as { status?: unknown }).status as 'pending' | 'approved' | 'rejected' | undefined) ??
            null)
        : null,
    createdAt: String(row.created_at ?? ''),
    rating: typeof row.rating === 'number' ? row.rating : null,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    note: typeof row.note === 'string' ? row.note : '',
    isPublic: row.is_public === true,
    imageUrl: imageMap.get(String(row.id)) ?? null,
  };
}

export async function updateUserCafeVisit(
  visitId: string,
  input: {
    rating?: number | null;
    tags?: string[];
    note?: string;
    photoAsset?: VisitPhotoAsset | null;
  }
): Promise<SupabaseActionResult> {
  const existing = await getUserCafeVisitById(visitId);
  if (!existing) return { ok: false, error: 'Visit not found.' };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return { ok: false, error: 'You must be signed in to edit a visit.' };
  const userId = data.user.id;

  let nextStoragePath: string | null = null;
  if (input.photoAsset?.uri) {
    const upload = await uploadCafePhotoAssetToStorage({
      userId,
      cafeId: existing.cafeId ?? `submission-${existing.submissionId ?? 'unknown'}`,
      asset: input.photoAsset,
    });
    if (!upload.ok) return upload;
    nextStoragePath = upload.storagePath;
  }
  if (!nextStoragePath) {
    nextStoragePath = await getLatestVisitPhotoStoragePath(visitId);
  }

  const nextRating = normalizeCoffeeRatingInput(input.rating ?? existing.rating);
  const nextTags = normalizeTags(input.tags ?? existing.tags);
  const nextNote = String(input.note ?? existing.note).trim();

  const updateRes = await supabase
    .from('user_cafe_visits')
    .update({
      rating: nextRating,
      tags: nextTags,
      note: nextNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId);
  if (updateRes.error) return { ok: false, error: updateRes.error.message };

  try {
    if (input.photoAsset?.uri && nextStoragePath) {
      await insertVisitPhoto({
        visitId,
        userId,
        storagePath: nextStoragePath,
      });
    }

    if (existing.cafeId && nextStoragePath) {
      await queueVisitPhotoForModeration({
        visitId,
        userId,
        cafeId: existing.cafeId,
        storagePath: nextStoragePath,
        note: nextNote,
      });
    }

    if (existing.submissionId && nextStoragePath) {
      await ensureSubmissionPhotoFromVisit({
        submissionId: existing.submissionId,
        userId,
        storagePath: nextStoragePath,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moderation routing failed.';
    console.error('[updateUserCafeVisit] moderation routing failed', {
      visitId,
      cafeId: existing.cafeId,
      submissionId: existing.submissionId,
      storagePath: nextStoragePath,
      message,
    });
    return { ok: false, error: `Visit updated, but moderation routing failed: ${message}` };
  }
  return { ok: true };
}

export async function deleteUserCafeVisit(visitId: string): Promise<SupabaseActionResult> {
  const key = String(visitId).trim();
  if (!key) return { ok: false, error: 'Visit id is required.' };
  await removeVisitFromPendingPublicPool(key);
  await supabase.from('visit_photos').delete().eq('visit_id', key);
  const del = await supabase.from('user_cafe_visits').delete().eq('id', key);
  if (del.error) return { ok: false, error: del.error.message };
  return { ok: true };
}

export async function getUserCafeVisitTimeline(): Promise<UserCafeVisit[]> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return [];

  const res = await supabase
    .from('user_cafe_visits')
    .select(
      'id, cafe_id, submission_id, created_at, rating, tags, note, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('user_id', data.user.id)
    .order('created_at', { ascending: false });

  if (res.error) return [];

  const rows = res.data ?? [];
  const photoMap = await fetchPrimaryPhotoUrlByVisitId(rows.map((row) => String(row.id)));
  const withSigned = await Promise.all(
    rows.map(async (row) => {
      return {
        id: String(row.id),
        cafeId: row.cafe_id == null ? null : String(row.cafe_id),
        submissionId: row.submission_id == null ? null : String(row.submission_id),
        submissionCafeName:
          row.cafe_submissions && typeof row.cafe_submissions === 'object'
            ? String((row.cafe_submissions as { cafe_name?: unknown }).cafe_name ?? '').trim() || null
            : null,
        submissionStatus:
          row.cafe_submissions && typeof row.cafe_submissions === 'object'
            ? (((row.cafe_submissions as { status?: unknown }).status as
                | 'pending'
                | 'approved'
                | 'rejected'
                | undefined) ?? null)
            : null,
        createdAt: String(row.created_at ?? ''),
        rating: typeof row.rating === 'number' ? row.rating : null,
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        note: typeof row.note === 'string' ? row.note : '',
        isPublic: row.is_public === true,
        imageUrl: photoMap.get(String(row.id)) ?? null,
      } satisfies UserCafeVisit;
    })
  );

  return withSigned;
}

/**
 * Most recent visit log for a specific cafe (current user only).
 * Returns null when not signed in or when no visit exists.
 */
export async function getMostRecentUserVisitForCafe(cafeId: string): Promise<UserCafeVisit | null> {
  const normalizedCafeId = String(cafeId).trim();
  if (!normalizedCafeId) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;

  const res = await supabase
    .from('user_cafe_visits')
    .select(
      'id, cafe_id, submission_id, created_at, rating, tags, note, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('user_id', data.user.id)
    .eq('cafe_id', normalizedCafeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error || !res.data) return null;

  const row = res.data;
  const imageMap = await fetchPrimaryPhotoUrlByVisitId([String(row.id)]);

  return {
    id: String(row.id),
    cafeId: row.cafe_id == null ? null : String(row.cafe_id),
    submissionId: row.submission_id == null ? null : String(row.submission_id),
    submissionCafeName:
      row.cafe_submissions && typeof row.cafe_submissions === 'object'
        ? String((row.cafe_submissions as { cafe_name?: unknown }).cafe_name ?? '').trim() || null
        : null,
    submissionStatus:
      row.cafe_submissions && typeof row.cafe_submissions === 'object'
        ? (((row.cafe_submissions as { status?: unknown }).status as
            | 'pending'
            | 'approved'
            | 'rejected'
            | undefined) ?? null)
        : null,
    createdAt: String(row.created_at ?? ''),
    rating: typeof row.rating === 'number' ? row.rating : null,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    note: typeof row.note === 'string' ? row.note : '',
    isPublic: row.is_public === true,
    imageUrl: imageMap.get(String(row.id)) ?? null,
  };
}
