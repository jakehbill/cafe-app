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
  | { ok: true; submissionId: string }
  | { ok: false; error: string };

/**
 * Inserts a café submission sourced from Google Places (New), after duplicate checks
 * on `cafes.google_place_id` and `cafe_submissions.google_place_id`.
 */
export async function submitGooglePlacesCafeSuggestion(input: {
  placeId: string;
  cafeName: string;
  addressText: string;
  googleMapsUrl: string | null;
  website: string | null;
  phoneNumber: string | null;
  latitude: number;
  longitude: number;
}): Promise<GooglePlacesCafeSubmissionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false, error: authError.message };
  }
  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: 'You must be signed in to suggest a cafe.' };
  }

  const googlePlaceId = input.placeId.trim();
  if (!googlePlaceId) {
    return { ok: false, error: 'Missing place id.' };
  }

  const liveRes = await supabase.from('cafes').select('id').eq('google_place_id', googlePlaceId).maybeSingle();
  if (liveRes.error) {
    return { ok: false, error: liveRes.error.message };
  }
  if (liveRes.data?.id != null) {
    return { ok: false, error: 'This café is already in Beaned.' };
  }

  const dupRes = await supabase
    .from('cafe_submissions')
    .select('id')
    .eq('google_place_id', googlePlaceId)
    .maybeSingle();
  if (dupRes.error) {
    return { ok: false, error: dupRes.error.message };
  }
  if (dupRes.data?.id != null) {
    return { ok: false, error: 'This café has already been suggested.' };
  }

  const mapsUrl = input.googleMapsUrl?.trim() ?? '';
  if (mapsUrl && !isValidOptionalUrl(mapsUrl)) {
    return { ok: false, error: 'Please enter a valid URL (including https://).' };
  }
  const website = input.website?.trim() ?? '';
  if (website && !isValidOptionalUrl(website)) {
    return { ok: false, error: 'Invalid website URL from place details.' };
  }

  const payload = {
    user_id: userId,
    cafe_name: input.cafeName.trim(),
    address_text: input.addressText.trim() || null,
    area: null,
    google_maps_url: mapsUrl || null,
    notes: null,
    selected_tags: [] as string[],
    google_place_id: googlePlaceId,
    latitude: input.latitude,
    longitude: input.longitude,
    website: website || null,
    phone_number: input.phoneNumber?.trim() || null,
    source: 'google_places',
    moderation_status: 'pending',
    status: 'pending' as CafeSubmissionStatus,
  };

  const res = await supabase.from('cafe_submissions').insert(payload).select('id').maybeSingle();
  if (res.error || !res.data?.id) {
    return { ok: false, error: res.error?.message ?? 'Submission could not be created.' };
  }

  return { ok: true, submissionId: String(res.data.id) };
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
