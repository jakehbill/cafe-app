import { AUTH_REQUIRED_MESSAGE } from '@/lib/authGate';
import { normalizeCoffeeRatingInput } from '@/lib/coffeeRating';
import { REVIEW_SCHEMA_VERSION } from '@/lib/reviewSchemaVersion';
import { rateCafe, supabase, type SupabaseActionResult } from '@/lib/supabase';
import { uploadCafePhotoAssetToStorage } from '@/lib/cafePhotoSubmissions';
import { MAX_VISIT_PHOTOS, type VisitPhotoAsset } from '@/lib/visitPhotoLimits';
import {
  formatCostToWorkDisplay,
  isBusynessValue,
  isCostToWorkValue,
  isQualityValue,
  isStayDurationValue,
  isWifiReliabilityValue,
  type BusynessValue,
  type CostToWorkValue,
  type QualityValue,
  type StayDurationValue,
  type WifiReliabilityValue,
} from '@/lib/workReview';

export type { VisitPhotoAsset } from '@/lib/visitPhotoLimits';

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
  stayDuration: StayDurationValue | null;
  costToWork: CostToWorkValue | null;
  wifiReliability: WifiReliabilityValue | null;
  busyness: BusynessValue | null;
  coffeeQuality: QualityValue | null;
  foodQuality: QualityValue | null;
  isPublic: boolean;
  /** Primary visit photo (first by sort_order). */
  imageUrl: string | null;
  /** All visit photos for diary / edit (sorted). */
  imageUrls: string[];
};

type SaveVisitInput = {
  cafeId?: string | null;
  submissionId?: string | null;
  rating?: number | null;
  tags?: string[];
  note?: string;
  stayDuration?: StayDurationValue | null;
  costToWork?: CostToWorkValue | null;
  wifiReliability?: WifiReliabilityValue | null;
  busyness?: BusynessValue | null;
  coffeeQuality?: QualityValue | null;
  foodQuality?: QualityValue | null;
  photoAssets?: VisitPhotoAsset[];
};

function normalizeOptionalEnum<T extends string>(
  raw: string | null | undefined,
  guard: (v: string) => v is T
): T | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  return guard(v) ? v : null;
}

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

async function fetchVisitPhotoUrlsByVisitId(visitIds: string[]): Promise<Map<string, string[]>> {
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

  const pathsByVisit = new Map<string, string[]>();
  for (const row of rows) {
    const visitId = String(row.visit_id ?? '').trim();
    const path = String(row.storage_path ?? '').trim();
    if (!visitId || !path) continue;
    const list = pathsByVisit.get(visitId) ?? [];
    list.push(path);
    pathsByVisit.set(visitId, list);
  }

  const out = new Map<string, string[]>();
  for (const [visitId, paths] of pathsByVisit) {
    const urls: string[] = [];
    for (const path of paths) {
      const url = await buildSignedUrl(path);
      if (url) urls.push(url);
    }
    if (urls.length > 0) out.set(visitId, urls);
  }
  return out;
}

async function getVisitPhotoCount(visitId: string): Promise<number> {
  const res = await supabase
    .from('visit_photos')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId);
  if (res.error) return 0;
  return res.count ?? 0;
}

async function persistVisitPhotoUploads(params: {
  visitId: string;
  userId: string;
  cafeId: string | null;
  submissionId: string | null;
  note: string;
  assets: VisitPhotoAsset[];
}) {
  const existingCount = await getVisitPhotoCount(params.visitId);
  const remaining = Math.max(0, MAX_VISIT_PHOTOS - existingCount);
  const assets = params.assets
    .filter((asset) => String(asset.uri ?? '').trim())
    .slice(0, remaining);
  for (const asset of assets) {
    const upload = await uploadCafePhotoAssetToStorage({
      userId: params.userId,
      cafeId: params.cafeId ?? `submission-${params.submissionId ?? 'unknown'}`,
      asset,
    });
    if (!upload.ok) {
      throw new Error(upload.error);
    }

    await insertVisitPhoto({
      visitId: params.visitId,
      userId: params.userId,
      storagePath: upload.storagePath,
    });

    if (params.cafeId) {
      await queueVisitPhotoForModeration({
        visitId: params.visitId,
        userId: params.userId,
        cafeId: params.cafeId,
        storagePath: upload.storagePath,
        note: params.note,
      });
    }

    if (params.submissionId) {
      await ensureSubmissionPhotoFromVisit({
        submissionId: params.submissionId,
        userId: params.userId,
        storagePath: upload.storagePath,
      });
    }
  }
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
  if ((countRes.count ?? 0) >= MAX_VISIT_PHOTOS) return;
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
  if (!userId) return { ok: false, error: AUTH_REQUIRED_MESSAGE };

  const cafeId = String(input.cafeId ?? '').trim();
  const submissionId = String(input.submissionId ?? '').trim();
  if (!cafeId && !submissionId) {
    return { ok: false, error: 'A space or submission id is required.' };
  }

  // Stamp schema version so tree-shaking keeps the constant in the app bundle.
  void REVIEW_SCHEMA_VERSION;
  const rating = normalizeCoffeeRatingInput(input.rating);
  const tags = normalizeTags(input.tags);
  const note = String(input.note ?? '').trim();
  const stayDuration = normalizeOptionalEnum(input.stayDuration, isStayDurationValue);
  const costToWork = normalizeOptionalEnum(input.costToWork, isCostToWorkValue);
  const wifiReliability = normalizeOptionalEnum(input.wifiReliability, isWifiReliabilityValue);
  const busyness = normalizeOptionalEnum(input.busyness, isBusynessValue);
  const coffeeQuality = normalizeOptionalEnum(input.coffeeQuality, isQualityValue);
  const foodQuality = normalizeOptionalEnum(input.foodQuality, isQualityValue);

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

  const photoAssets = (input.photoAssets ?? [])
    .filter((asset) => String(asset.uri ?? '').trim())
    .slice(0, MAX_VISIT_PHOTOS);

  const insertVisit = await supabase
    .from('user_cafe_visits')
    .insert({
      user_id: userId,
      cafe_id: cafeId || null,
      submission_id: submissionId || null,
      rating,
      tags,
      note,
      stay_duration: stayDuration,
      cost_to_work: costToWork,
      wifi_reliability: wifiReliability,
      busyness,
      coffee_quality: coffeeQuality,
      food_quality: foodQuality,
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
    if (photoAssets.length > 0) {
      await persistVisitPhotoUploads({
        visitId,
        userId,
        cafeId: cafeId || null,
        submissionId: submissionId || null,
        note,
        assets: photoAssets,
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
      photoCount: photoAssets.length,
      message,
    });
    return { ok: false, error: `Visit saved, but moderation routing failed: ${message}` };
  }

  return { ok: true };
}

function mapVisitRowToUserCafeVisit(
  row: Record<string, unknown>,
  photoUrls: string[]
): UserCafeVisit {
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
    stayDuration: normalizeOptionalEnum(
      typeof row.stay_duration === 'string' ? row.stay_duration : null,
      isStayDurationValue
    ),
    costToWork: normalizeOptionalEnum(
      typeof row.cost_to_work === 'string' ? row.cost_to_work : null,
      isCostToWorkValue
    ),
    wifiReliability: normalizeOptionalEnum(
      typeof row.wifi_reliability === 'string' ? row.wifi_reliability : null,
      isWifiReliabilityValue
    ),
    busyness: normalizeOptionalEnum(
      typeof row.busyness === 'string' ? row.busyness : null,
      isBusynessValue
    ),
    coffeeQuality: normalizeOptionalEnum(
      typeof row.coffee_quality === 'string' ? row.coffee_quality : null,
      isQualityValue
    ),
    foodQuality: normalizeOptionalEnum(
      typeof row.food_quality === 'string' ? row.food_quality : null,
      isQualityValue
    ),
    isPublic: row.is_public === true,
    imageUrl: photoUrls[0] ?? null,
    imageUrls: photoUrls,
  };
}

export async function getUserCafeVisitById(visitId: string): Promise<UserCafeVisit | null> {
  const key = String(visitId).trim();
  if (!key) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;
  const res = await supabase
    .from('user_cafe_visits')
    .select(
      'id, cafe_id, submission_id, created_at, rating, tags, note, stay_duration, cost_to_work, wifi_reliability, busyness, coffee_quality, food_quality, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('id', key)
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (res.error || !res.data) return null;
  const row = res.data;
  const imageMap = await fetchVisitPhotoUrlsByVisitId([String(row.id)]);
  return mapVisitRowToUserCafeVisit(row as Record<string, unknown>, imageMap.get(String(row.id)) ?? []);
}

export async function updateUserCafeVisit(
  visitId: string,
  input: {
    rating?: number | null;
    tags?: string[];
    note?: string;
    stayDuration?: StayDurationValue | null;
    costToWork?: CostToWorkValue | null;
    wifiReliability?: WifiReliabilityValue | null;
    busyness?: BusynessValue | null;
    coffeeQuality?: QualityValue | null;
    foodQuality?: QualityValue | null;
    photoAssets?: VisitPhotoAsset[];
  }
): Promise<SupabaseActionResult> {
  const existing = await getUserCafeVisitById(visitId);
  if (!existing) return { ok: false, error: 'Visit not found.' };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  const userId = data.user.id;

  const newPhotoAssets = (input.photoAssets ?? [])
    .filter((asset) => String(asset.uri ?? '').trim())
    .slice(0, MAX_VISIT_PHOTOS);
  if (newPhotoAssets.length > 0) {
    const existingCount = await getVisitPhotoCount(visitId);
    if (existingCount + newPhotoAssets.length > MAX_VISIT_PHOTOS) {
      return {
        ok: false,
        error: `This visit already has ${existingCount} photo${existingCount === 1 ? '' : 's'}. You can add up to ${MAX_VISIT_PHOTOS} total.`,
      };
    }
  }

  const nextRating = normalizeCoffeeRatingInput(input.rating ?? existing.rating);
  const nextTags = normalizeTags(input.tags ?? existing.tags);
  const nextNote = String(input.note ?? existing.note).trim();
  const nextStay =
    input.stayDuration !== undefined
      ? normalizeOptionalEnum(input.stayDuration, isStayDurationValue)
      : existing.stayDuration;
  const nextCost =
    input.costToWork !== undefined
      ? normalizeOptionalEnum(input.costToWork, isCostToWorkValue)
      : existing.costToWork;
  const nextWifi =
    input.wifiReliability !== undefined
      ? normalizeOptionalEnum(input.wifiReliability, isWifiReliabilityValue)
      : existing.wifiReliability;
  const nextBusy =
    input.busyness !== undefined
      ? normalizeOptionalEnum(input.busyness, isBusynessValue)
      : existing.busyness;
  const nextCoffeeQ =
    input.coffeeQuality !== undefined
      ? normalizeOptionalEnum(input.coffeeQuality, isQualityValue)
      : existing.coffeeQuality;
  const nextFoodQ =
    input.foodQuality !== undefined
      ? normalizeOptionalEnum(input.foodQuality, isQualityValue)
      : existing.foodQuality;

  const updateRes = await supabase
    .from('user_cafe_visits')
    .update({
      rating: nextRating,
      tags: nextTags,
      note: nextNote,
      stay_duration: nextStay,
      cost_to_work: nextCost,
      wifi_reliability: nextWifi,
      busyness: nextBusy,
      coffee_quality: nextCoffeeQ,
      food_quality: nextFoodQ,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId);
  if (updateRes.error) return { ok: false, error: updateRes.error.message };

  try {
    if (newPhotoAssets.length > 0) {
      await persistVisitPhotoUploads({
        visitId,
        userId,
        cafeId: existing.cafeId,
        submissionId: existing.submissionId,
        note: nextNote,
        assets: newPhotoAssets,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moderation routing failed.';
    console.error('[updateUserCafeVisit] moderation routing failed', {
      visitId,
      cafeId: existing.cafeId,
      submissionId: existing.submissionId,
      newPhotoCount: newPhotoAssets.length,
      message,
    });
    return { ok: false, error: `Visit updated, but moderation routing failed: ${message}` };
  }

  if (existing.cafeId && nextRating != null) {
    const rateRes = await rateCafe(existing.cafeId, {
      coffee: nextRating,
      tags: nextTags,
      notes: nextNote,
    });
    if (!rateRes.ok) {
      return {
        ok: false,
        error: `Visit updated, but public rating sync failed: ${rateRes.error}`,
      };
    }
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
      'id, cafe_id, submission_id, created_at, rating, tags, note, stay_duration, cost_to_work, wifi_reliability, busyness, coffee_quality, food_quality, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('user_id', data.user.id)
    .order('created_at', { ascending: false });

  if (res.error) return [];

  const rows = res.data ?? [];
  const photoMap = await fetchVisitPhotoUrlsByVisitId(rows.map((row) => String(row.id)));
  return rows.map((row) =>
    mapVisitRowToUserCafeVisit(row as Record<string, unknown>, photoMap.get(String(row.id)) ?? [])
  );
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
      'id, cafe_id, submission_id, created_at, rating, tags, note, stay_duration, cost_to_work, wifi_reliability, busyness, coffee_quality, food_quality, is_public, cafe_submissions(cafe_name,status)'
    )
    .eq('user_id', data.user.id)
    .eq('cafe_id', normalizedCafeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error || !res.data) return null;

  const row = res.data;
  const imageMap = await fetchVisitPhotoUrlsByVisitId([String(row.id)]);
  return mapVisitRowToUserCafeVisit(row as Record<string, unknown>, imageMap.get(String(row.id)) ?? []);
}

/**
 * Community “Cost to work” for detail — mode of `cost_to_work` on visits for this cafe.
 * Not part of Work Score. Prefers security-definer RPC when deployed.
 */
export async function getCafeCostToWorkSummary(cafeId: string): Promise<string | null> {
  const id = String(cafeId ?? '').trim();
  if (!id) return null;

  const rpc = await supabase.rpc('get_cafe_cost_to_work_summary', { p_cafe_id: id });
  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
    const raw = String((rpc.data[0] as { cost_to_work?: unknown }).cost_to_work ?? '').trim();
    return formatCostToWorkDisplay(raw);
  }

  // Fallback: own visits only (RLS) if RPC not deployed yet.
  const res = await supabase
    .from('user_cafe_visits')
    .select('cost_to_work')
    .eq('cafe_id', id)
    .not('cost_to_work', 'is', null)
    .limit(200);
  if (res.error || !res.data?.length) return null;

  const counts = new Map<string, number>();
  for (const row of res.data) {
    const raw = String((row as { cost_to_work?: unknown }).cost_to_work ?? '').trim();
    if (!isCostToWorkValue(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return formatCostToWorkDisplay(best);
}
