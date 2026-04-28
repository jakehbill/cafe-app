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
  storagePath: string | null;
};

type SaveVisitInput = {
  cafeId?: string | null;
  submissionId?: string | null;
  rating?: number | null;
  tags?: string[];
  note?: string;
  isPublic?: boolean;
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
    .select('id, status')
    .eq('source_visit_id', params.visitId)
    .limit(1);
  if (!existing.error && (existing.data?.length ?? 0) > 0) return;
  await supabase.from('cafe_photos').insert({
    user_id: params.userId,
    cafe_id: numericCafeId,
    storage_path: params.storagePath,
    image_url: null,
    caption: params.note.length > 0 ? params.note.slice(0, 280) : null,
    source_visit_id: params.visitId,
    status: 'pending',
  });
}

async function removeVisitFromPendingPublicPool(visitId: string) {
  await supabase.from('cafe_photos').delete().eq('source_visit_id', visitId).eq('status', 'pending');
}

function normalizeRating(rating: number | null | undefined): number | null {
  if (typeof rating !== 'number') return null;
  return Math.min(5, Math.max(1, Math.round(rating * 2) / 2));
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

  const rating = normalizeRating(input.rating);
  const tags = normalizeTags(input.tags);
  const note = String(input.note ?? '').trim();
  const isPublic = input.isPublic === true;

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
  let imageUrl: string | null = null;
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
      storage_path: storagePath,
      image_url: imageUrl,
      is_public: isPublic,
    })
    .select('id')
    .single();
  if (insertVisit.error) return { ok: false, error: insertVisit.error.message };
  const visitId = String(insertVisit.data.id);

  if (cafeId) {
    await ensureLegacyVisitedRow({ userId, cafeId });
  }

  if (isPublic && storagePath && cafeId) {
    await queueVisitPhotoForModeration({
      visitId,
      userId,
      cafeId,
      storagePath,
      note,
    });
  }

  if (isPublic && rating != null && cafeId) {
    await rateCafe(cafeId, {
      coffee: rating,
      tags,
      notes: note,
    });
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
      'id, cafe_id, submission_id, created_at, rating, tags, note, image_url, storage_path, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('id', key)
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (res.error || !res.data) return null;
  const row = res.data;
  const directUrl = typeof row.image_url === 'string' ? row.image_url.trim() : '';
  const signed = directUrl.length > 0 ? directUrl : await buildSignedUrl(row.storage_path ?? null);
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
    imageUrl: signed,
    storagePath: typeof row.storage_path === 'string' ? row.storage_path : null,
  };
}

export async function updateUserCafeVisit(
  visitId: string,
  input: {
    rating?: number | null;
    tags?: string[];
    note?: string;
    isPublic?: boolean;
    photoAsset?: VisitPhotoAsset | null;
  }
): Promise<SupabaseActionResult> {
  const existing = await getUserCafeVisitById(visitId);
  if (!existing) return { ok: false, error: 'Visit not found.' };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return { ok: false, error: 'You must be signed in to edit a visit.' };
  const userId = data.user.id;

  let nextStoragePath = existing.storagePath;
  if (input.photoAsset?.uri) {
    const upload = await uploadCafePhotoAssetToStorage({
      userId,
      cafeId: existing.cafeId ?? `submission-${existing.submissionId ?? 'unknown'}`,
      asset: input.photoAsset,
    });
    if (!upload.ok) return upload;
    nextStoragePath = upload.storagePath;
  }

  const nextRating = normalizeRating(input.rating ?? existing.rating);
  const nextTags = normalizeTags(input.tags ?? existing.tags);
  const nextNote = String(input.note ?? existing.note).trim();
  const nextIsPublic = input.isPublic ?? existing.isPublic;

  const updateRes = await supabase
    .from('user_cafe_visits')
    .update({
      rating: nextRating,
      tags: nextTags,
      note: nextNote,
      is_public: nextIsPublic,
      storage_path: nextStoragePath,
      image_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId);
  if (updateRes.error) return { ok: false, error: updateRes.error.message };

  if (nextIsPublic && existing.cafeId && nextStoragePath) {
    await queueVisitPhotoForModeration({
      visitId,
      userId,
      cafeId: existing.cafeId,
      storagePath: nextStoragePath,
      note: nextNote,
    });
  }
  if (!nextIsPublic) {
    await removeVisitFromPendingPublicPool(visitId);
  }

  return { ok: true };
}

export async function deleteUserCafeVisit(visitId: string): Promise<SupabaseActionResult> {
  const key = String(visitId).trim();
  if (!key) return { ok: false, error: 'Visit id is required.' };
  await removeVisitFromPendingPublicPool(key);
  const del = await supabase.from('user_cafe_visits').delete().eq('id', key);
  if (del.error) return { ok: false, error: del.error.message };
  return { ok: true };
}

export async function setUserCafeVisitVisibility(
  visitId: string,
  isPublic: boolean
): Promise<SupabaseActionResult> {
  return updateUserCafeVisit(visitId, { isPublic });
}

export async function getUserCafeVisitTimeline(): Promise<UserCafeVisit[]> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return [];

  const res = await supabase
    .from('user_cafe_visits')
    .select(
      'id, cafe_id, submission_id, created_at, rating, tags, note, image_url, storage_path, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('user_id', data.user.id)
    .order('created_at', { ascending: false });

  if (res.error) return [];

  const rows = res.data ?? [];
  const withSigned = await Promise.all(
    rows.map(async (row) => {
      const directUrl = typeof row.image_url === 'string' ? row.image_url.trim() : '';
      const signed = directUrl.length > 0 ? directUrl : await buildSignedUrl(row.storage_path ?? null);
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
        imageUrl: signed,
        storagePath: typeof row.storage_path === 'string' ? row.storage_path : null,
      } satisfies UserCafeVisit;
    })
  );

  return withSigned;
}
