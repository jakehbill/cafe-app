import type { GooglePlaceDetailsForSubmission } from '@/lib/googlePlaces';
import { supabase, type SupabaseActionResult } from '@/lib/supabase';

export type CafeSubmissionStatus = 'pending' | 'approved' | 'rejected';

export type CafeSubmissionInsertInput = {
  cafeName: string;
  addressText?: string;
  area?: string;
  googleMapsUrl?: string;
  notes?: string;
  selectedTags?: string[];
};

export type CafeSubmissionCreateResult =
  | { ok: true; submissionId: string; userId: string }
  | { ok: false; error: string };

export type MyCafeSubmissionRow = {
  id: string;
  created_at: string;
  cafe_name: string;
  area: string | null;
  status: CafeSubmissionStatus;
};

function normalizeSuggestionKey(name: string, area?: string | null): string {
  return `${name.trim().toLowerCase()}::${(area ?? '').trim().toLowerCase()}`;
}

export function isValidOptionalUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function submitCafeSuggestion(
  input: CafeSubmissionInsertInput
): Promise<SupabaseActionResult> {
  const res = await createCafeSuggestionWithId(input);
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  return { ok: true };
}

export async function createCafeSuggestionWithId(
  input: CafeSubmissionInsertInput
): Promise<CafeSubmissionCreateResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false, error: authError.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to suggest a cafe.' };
  }

  const cafeName = input.cafeName.trim();
  if (!cafeName) {
    return { ok: false, error: 'Cafe name is required.' };
  }

  const googleMapsUrl = input.googleMapsUrl?.trim() ?? '';
  if (!isValidOptionalUrl(googleMapsUrl)) {
    return { ok: false, error: 'Please enter a valid URL (including https://).' };
  }

  const selectedTags = Array.from(
    new Set((input.selectedTags ?? []).map((tag) => tag.trim()).filter(Boolean))
  );

  // Anti-spam: prevent repeated rewards/rows for the same user's same cafe suggestion.
  const existingRes = await supabase
    .from('cafe_submissions')
    .select('id, cafe_name, area')
    .eq('user_id', userId);
  if (existingRes.error) {
    return { ok: false, error: existingRes.error.message };
  }
  const incomingKey = normalizeSuggestionKey(cafeName, input.area);
  const hasDuplicate = (existingRes.data ?? []).some(
    (row) => normalizeSuggestionKey(String(row.cafe_name ?? ''), String(row.area ?? '')) === incomingKey
  );
  if (hasDuplicate) {
    return {
      ok: false,
      error: 'You have already suggested this cafe. Thanks — we already have it in review history.',
    };
  }

  const payload = {
    user_id: userId,
    cafe_name: cafeName,
    address_text: input.addressText?.trim() || null,
    area: input.area?.trim() || null,
    google_maps_url: googleMapsUrl || null,
    notes: input.notes?.trim() || null,
    selected_tags: selectedTags,
  };

  const res = await supabase
    .from('cafe_submissions')
    .insert(payload)
    .select('id')
    .maybeSingle();
  if (res.error || !res.data?.id) {
    return { ok: false, error: res.error?.message ?? 'Submission could not be created.' };
  }

  return { ok: true, submissionId: String(res.data.id), userId };
}

export type GooglePlacesCafeSubmissionResult =
  | { ok: true; submissionId: string; userId: string }
  | { ok: false; error: string };

/** Row shape for `public.cafe_submissions` inserts from Google Place Details (single source of truth for mapping). */
export type GooglePlacesCafeSubmissionInsertRow = {
  /** Submitting user (same as `submitted_by_user_id` when that column exists in your schema). */
  user_id: string;
  google_place_id: string;
  cafe_name: string;
  address_text: string | null;
  google_maps_url: string | null;
  latitude: number;
  longitude: number;
  website: string | null;
  phone_number: string | null;
  notes: string | null;
  area: null;
  selected_tags: string[];
  source: 'google_places';
  moderation_status: 'pending';
  status: CafeSubmissionStatus;
};

export type GooglePlacesCafeSubmissionExtras = {
  notes?: string | null;
  selectedTags?: string[];
};

/**
 * Maps Google Place Details (+ optional Beaned fields) → `cafe_submissions` insert payload.
 * Google fields: place.id → google_place_id, displayName.text → cafe_name, formattedAddress → address_text, etc.
 */
export function buildGooglePlacesCafeSubmissionPayload(
  place: GooglePlaceDetailsForSubmission,
  userId: string,
  extras?: GooglePlacesCafeSubmissionExtras
): GooglePlacesCafeSubmissionInsertRow {
  const google_place_id = place.placeId.trim();
  const cafe_name = place.cafeName.trim();
  const address_text = place.formattedAddress.trim() || null;
  const google_maps_url = (place.googleMapsUri ?? '').trim() || null;
  const website = (place.websiteUri ?? '').trim() || null;
  const phone_number = (place.nationalPhoneNumber ?? '').trim() || null;
  const notes = extras?.notes?.trim() || null;
  const selected_tags = Array.from(
    new Set((extras?.selectedTags ?? []).map((tag) => tag.trim()).filter(Boolean))
  );

  return {
    user_id: userId,
    google_place_id,
    cafe_name,
    address_text,
    google_maps_url,
    latitude: place.latitude,
    longitude: place.longitude,
    website: website || null,
    phone_number: phone_number || null,
    notes,
    area: null,
    selected_tags,
    source: 'google_places',
    moderation_status: 'pending',
    status: 'pending',
  };
}

function isPostgresUndefinedColumnMessage(message: string): boolean {
  return message.includes('column') && message.includes('does not exist');
}

/**
 * If `cafes.google_place_id` exists: match by that id.
 * If that column is missing, or no row matched: fall back to `google_maps_url` containing the Place id.
 * Otherwise treat as no live duplicate (safe when schema is minimal).
 */
async function liveCafeAlreadyExistsForGooglePlace(googlePlaceId: string): Promise<{
  exists: boolean;
  error: string | null;
}> {
  const byPlaceIdCol = await supabase.from('cafes').select('id').eq('google_place_id', googlePlaceId).maybeSingle();

  if (!byPlaceIdCol.error && byPlaceIdCol.data?.id != null) {
    return { exists: true, error: null };
  }

  if (byPlaceIdCol.error && !isPostgresUndefinedColumnMessage(byPlaceIdCol.error.message)) {
    return { exists: false, error: byPlaceIdCol.error.message };
  }

  const byMapsUrl = await supabase
    .from('cafes')
    .select('id')
    .ilike('google_maps_url', `%${googlePlaceId}%`)
    .limit(1)
    .maybeSingle();

  if (!byMapsUrl.error && byMapsUrl.data?.id != null) {
    return { exists: true, error: null };
  }

  if (byMapsUrl.error && !isPostgresUndefinedColumnMessage(byMapsUrl.error.message)) {
    return { exists: false, error: byMapsUrl.error.message };
  }

  return { exists: false, error: null };
}

type GooglePlaceDupRow = {
  id: string;
  user_id: string | null;
  status: string | null;
  moderation_status?: string | null;
};

/**
 * Prefer `status` for lifecycle (moderation updates it on approve/reject).
 * Falls back to `moderation_status` when `status` is not a known value.
 */
function effectiveModerationStatus(row: {
  status?: string | null;
  moderation_status?: string | null;
}): 'pending' | 'approved' | 'rejected' {
  const s = (row.status ?? '').trim().toLowerCase();
  if (s === 'pending' || s === 'approved' || s === 'rejected') return s;
  const m = (row.moderation_status ?? '').trim().toLowerCase();
  if (m === 'pending' || m === 'approved' || m === 'rejected') return m;
  return 'pending';
}

function isActiveSubmissionStatus(e: 'pending' | 'approved' | 'rejected'): boolean {
  return e === 'pending' || e === 'approved';
}

async function fetchSubmissionsForGooglePlaceDuplicateCheck(googlePlaceId: string): Promise<{
  rows: GooglePlaceDupRow[];
  error: string | null;
}> {
  let res = await supabase
    .from('cafe_submissions')
    .select('id, user_id, status, moderation_status')
    .eq('google_place_id', googlePlaceId);

  if (res.error && isPostgresUndefinedColumnMessage(res.error.message)) {
    const res2 = await supabase
      .from('cafe_submissions')
      .select('id, user_id, status')
      .eq('google_place_id', googlePlaceId);
    if (res2.error) {
      return { rows: [], error: res2.error.message };
    }
    return { rows: (res2.data ?? []) as GooglePlaceDupRow[], error: null };
  }

  if (res.error) {
    return { rows: [], error: res.error.message };
  }

  return { rows: (res.data ?? []) as GooglePlaceDupRow[], error: null };
}

/**
 * Inserts a pending `cafe_submissions` row from Google Place Details. Duplicate checks:
 * Blocks when any submission for this `google_place_id` is **active** (`pending` or `approved` on `status`,
 * or the same on `moderation_status` if `status` is unset). **Rejected** rows do not block re-submission.
 * Then live `cafes` by `google_place_id` when that column exists, else `cafes.google_maps_url` ILIKE the Place id.
 */
export async function submitGooglePlacesCafeSuggestion(
  place: GooglePlaceDetailsForSubmission,
  extras?: GooglePlacesCafeSubmissionExtras
): Promise<GooglePlacesCafeSubmissionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false, error: authError.message };
  }
  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to suggest a cafe.' };
  }

  const googlePlaceId = place.placeId.trim();
  if (!googlePlaceId) {
    return { ok: false, error: 'Missing place id.' };
  }

  const { rows: dupRows, error: dupFetchError } = await fetchSubmissionsForGooglePlaceDuplicateCheck(googlePlaceId);
  if (dupFetchError) {
    return { ok: false, error: dupFetchError };
  }

  const hasBlockingActive = dupRows.some((row) => isActiveSubmissionStatus(effectiveModerationStatus(row)));
  if (hasBlockingActive) {
    const currentUserHasActive = dupRows.some(
      (row) =>
        String(row.user_id ?? '').trim() === userId &&
        isActiveSubmissionStatus(effectiveModerationStatus(row))
    );
    return {
      ok: false,
      error: currentUserHasActive
        ? 'You already have an active suggestion for this café (pending or approved).'
        : 'This café already has an active suggestion (pending or approved).',
    };
  }

  const live = await liveCafeAlreadyExistsForGooglePlace(googlePlaceId);
  if (live.error) {
    return { ok: false, error: live.error };
  }
  if (live.exists) {
    return { ok: false, error: 'This café is already in Beaned.' };
  }

  const payload = buildGooglePlacesCafeSubmissionPayload(place, userId, extras);

  const mapsUrl = payload.google_maps_url ?? '';
  if (mapsUrl && !isValidOptionalUrl(mapsUrl)) {
    return { ok: false, error: 'Please enter a valid URL (including https://).' };
  }
  const website = payload.website ?? '';
  if (website && !isValidOptionalUrl(website)) {
    return { ok: false, error: 'Invalid website URL from place details.' };
  }

  const res = await supabase.from('cafe_submissions').insert(payload).select('id').maybeSingle();
  if (res.error || !res.data?.id) {
    return { ok: false, error: res.error?.message ?? 'Submission could not be created.' };
  }

  return { ok: true, submissionId: String(res.data.id), userId };
}

export async function getMyCafeSubmissions(limit = 8): Promise<MyCafeSubmissionRow[]> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user?.id) {
    return [];
  }

  const res = await supabase
    .from('cafe_submissions')
    .select('id, created_at, cafe_name, area, status')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (res.error) {
    return [];
  }

  return (res.data ?? []) as MyCafeSubmissionRow[];
}
