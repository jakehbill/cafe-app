import {
  placeHasValidCoordinates,
  type GooglePlaceDetailsForSubmission,
} from '@/lib/googlePlaces';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/authGate';
import { quantizeCoffeeRatingForStorage } from '@/lib/coffeeRating';
import { supabase, type SupabaseActionResult } from '@/lib/supabase';
import { normalizeVenueType, type VenueTypeValue } from '@/lib/venueTypes';

export type CafeSubmissionStatus = 'pending' | 'approved' | 'rejected';

export type CafeSubmissionInsertInput = {
  cafeName: string;
  addressText?: string;
  area?: string;
  googleMapsUrl?: string;
  notes?: string;
  selectedTags?: string[];
  /** Required for new space suggestions — stored as `cafe_submissions.venue_type`. */
  venueType: VenueTypeValue;
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
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const cafeName = input.cafeName.trim();
  if (!cafeName) {
    return { ok: false, error: 'Space name is required.' };
  }

  const venueType = normalizeVenueType(input.venueType);

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
      error: 'You have already suggested this space. Thanks — we already have it in review history.',
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
    venue_type: venueType,
    status: 'pending' as const,
    moderation_status: 'pending' as const,
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
  /** Submitting user’s coffee score (1.0–5.0); optional if `cafe_submissions.coffee_rating` exists. */
  coffee_rating?: number | null;
  venue_type: VenueTypeValue;
  source: 'google_places';
  moderation_status: 'pending';
  status: CafeSubmissionStatus;
};

export type GooglePlacesCafeSubmissionExtras = {
  notes?: string | null;
  selectedTags?: string[];
  /** User’s Beaned Work Score (1–10); persisted when `cafe_submissions.coffee_rating` exists. */
  coffeeRating?: number | null;
  venueType: VenueTypeValue;
};

/**
 * Maps Google Place Details (+ optional Beaned fields) → `cafe_submissions` insert payload.
 * Google fields: place.id → google_place_id, displayName.text → cafe_name, formattedAddress → address_text, etc.
 */
function clampCoffeeRatingForSubmission(value: number): number {
  if (!Number.isFinite(value)) return quantizeCoffeeRatingForStorage(3);
  return quantizeCoffeeRatingForStorage(value);
}

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

  // Preserve full Google Places precision (no rounding before insert).
  const latitude = place.latitude;
  const longitude = place.longitude;

  const row: GooglePlacesCafeSubmissionInsertRow = {
    user_id: userId,
    google_place_id,
    cafe_name,
    address_text,
    google_maps_url,
    latitude,
    longitude,
    website: website || null,
    phone_number: phone_number || null,
    notes,
    area: null,
    selected_tags,
    venue_type: normalizeVenueType(extras?.venueType),
    source: 'google_places',
    moderation_status: 'pending',
    status: 'pending',
  };

  if (extras?.coffeeRating != null && Number.isFinite(extras.coffeeRating)) {
    row.coffee_rating = clampCoffeeRatingForSubmission(extras.coffeeRating);
  }

  return row;
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
  submitted_by_user_id?: string | null;
  cafe_name: string | null;
  google_place_id: string | null;
  moderation_status?: string | null;
  status: string | null;
  created_at: string | null;
};

/** `moderation_status` only (not `status`) — matches partial unique index semantics. */
function normalizeModerationStatusForDuplicateCheck(moderationStatus: string | null | undefined): string {
  return String(moderationStatus ?? '').trim().toLowerCase();
}

/** Block only when `moderation_status` normalizes to pending or approved. */
function googlePlaceRowBlocksResubmit(row: GooglePlaceDupRow): boolean {
  const m = normalizeModerationStatusForDuplicateCheck(row.moderation_status);
  return m === 'pending' || m === 'approved';
}

function logGooglePlaceDupRowsBeforeInsert(googlePlaceId: string, rows: GooglePlaceDupRow[]): void {
  if (!__DEV__) return;
  console.log(
    `[submitGooglePlacesCafeSuggestion] cafe_submissions for google_place_id="${googlePlaceId}" (before insert), count=${rows.length} (duplicate check uses moderation_status only)`
  );
  for (const r of rows) {
    const submitter =
      String((r as GooglePlaceDupRow).submitted_by_user_id ?? r.user_id ?? '').trim() || null;
    console.log('[submitGooglePlacesCafeSuggestion] row:', {
      id: r.id,
      cafe_name: r.cafe_name,
      google_place_id: r.google_place_id,
      moderation_status: r.moderation_status,
      normalized_moderation_status: normalizeModerationStatusForDuplicateCheck(r.moderation_status),
      status: r.status,
      submitted_by_user_id: submitter,
      created_at: r.created_at,
    });
  }
}

async function fetchSubmissionsForGooglePlaceDuplicateCheck(googlePlaceId: string): Promise<{
  rows: GooglePlaceDupRow[];
  error: string | null;
}> {
  const selectAttempts: string[] = [
    'id, cafe_name, google_place_id, user_id, submitted_by_user_id, moderation_status, status, created_at',
    'id, cafe_name, google_place_id, user_id, moderation_status, status, created_at',
    'id, cafe_name, google_place_id, user_id, status, created_at',
  ];

  let lastError: string | null = null;
  for (const sel of selectAttempts) {
    const res = await supabase.from('cafe_submissions').select(sel as never).eq('google_place_id', googlePlaceId);
    if (!res.error) {
      return { rows: ((res.data ?? []) as unknown) as GooglePlaceDupRow[], error: null };
    }
    lastError = res.error.message;
    if (!isPostgresUndefinedColumnMessage(res.error.message)) {
      return { rows: [], error: lastError };
    }
  }

  return { rows: [], error: lastError ?? 'Could not load existing submissions.' };
}

/**
 * Inserts a pending `cafe_submissions` row from Google Place Details.
 * Duplicate check: same `google_place_id` only blocks when some row’s **`moderation_status`**
 * (normalized with trim + lowercase) is **`pending`** or **`approved`**.
 * Does not use legacy **`status`** for this gate. Rejected, empty, null, archived, etc. do not block here.
 * Live `cafes` duplicate check unchanged.
 */
export async function submitGooglePlacesCafeSuggestion(
  place: GooglePlaceDetailsForSubmission,
  extras?: GooglePlacesCafeSubmissionExtras
): Promise<GooglePlacesCafeSubmissionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }
  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const googlePlaceId = place.placeId.trim();
  if (!googlePlaceId) {
    return { ok: false, error: 'Missing place id.' };
  }

  if (!placeHasValidCoordinates(place)) {
    return {
      ok: false,
      error:
        'This place is missing map coordinates from Google Places. Go back, pick it again, or try another result.',
    };
  }

  const { rows: dupRows, error: dupFetchError } = await fetchSubmissionsForGooglePlaceDuplicateCheck(googlePlaceId);
  if (dupFetchError) {
    return { ok: false, error: dupFetchError };
  }

  logGooglePlaceDupRowsBeforeInsert(googlePlaceId, dupRows);

  const blockingRows = dupRows.filter((row) => googlePlaceRowBlocksResubmit(row));
  if (blockingRows.length > 0) {
    console.log('[submitGooglePlacesCafeSuggestion] duplicate block', {
      google_place_id: googlePlaceId,
      blocking_normalized_moderation_statuses: blockingRows.map((r) =>
        normalizeModerationStatusForDuplicateCheck(r.moderation_status)
      ),
      blocking_row_ids: blockingRows.map((r) => r.id),
      blocking_raw_moderation_statuses: blockingRows.map((r) => r.moderation_status),
    });
    return { ok: false, error: 'This space has already been suggested.' };
  }

  const live = await liveCafeAlreadyExistsForGooglePlace(googlePlaceId);
  if (live.error) {
    return { ok: false, error: live.error };
  }
  if (live.exists) {
    return { ok: false, error: 'This space is already in Beaned.' };
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

  let insertPayload: GooglePlacesCafeSubmissionInsertRow = payload;
  let res = await supabase.from('cafe_submissions').insert(insertPayload).select('id').maybeSingle();

  if (
    res.error &&
    isPostgresUndefinedColumnMessage(res.error.message) &&
    insertPayload.coffee_rating != null
  ) {
    if (__DEV__) {
      console.warn(
        '[submitGooglePlacesCafeSuggestion] cafe_submissions.coffee_rating missing; retry insert without rating. Add column: alter table public.cafe_submissions add column if not exists coffee_rating numeric(2,1);'
      );
    }
    const { coffee_rating: _omit, ...withoutRating } = insertPayload;
    insertPayload = withoutRating as GooglePlacesCafeSubmissionInsertRow;
    res = await supabase.from('cafe_submissions').insert(insertPayload).select('id').maybeSingle();
  }

  if (res.error || !res.data?.id) {
    const msg = res.error?.message ?? '';
    if (
      msg.includes('cafe_submissions_active_google_place_id_unique') ||
      (msg.toLowerCase().includes('duplicate key') && msg.includes('google_place_id'))
    ) {
      return { ok: false, error: 'This space has already been suggested.' };
    }
    return { ok: false, error: msg || 'Submission could not be created.' };
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
