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
