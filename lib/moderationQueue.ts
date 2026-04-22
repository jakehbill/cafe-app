import { supabase, type SupabaseActionResult } from '@/lib/supabase';

const CAFE_USER_PHOTO_BUCKET = 'cafe-user-photos';

export type PendingCafeSuggestion = {
  id: string;
  created_at: string;
  cafe_name: string;
  address_text: string | null;
  area: string | null;
  google_maps_url: string | null;
  notes: string | null;
  selected_tags: string[] | null;
  status?: string;
};

export type PendingPhotoSubmission = {
  id: string;
  created_at: string;
  cafe_id: number;
  storage_path: string;
  caption: string | null;
  preview_url: string | null;
};

export async function fetchPendingCafeSuggestions(): Promise<PendingCafeSuggestion[]> {
  const res = await supabase
    .from('cafe_submissions')
    .select('id, created_at, cafe_name, address_text, area, google_maps_url, notes, selected_tags')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (res.error) {
    return [];
  }

  return (res.data ?? []) as PendingCafeSuggestion[];
}

export async function fetchCafeSubmissionById(id: string): Promise<PendingCafeSuggestion | null> {
  const res = await supabase
    .from('cafe_submissions')
    .select(
      'id, created_at, cafe_name, address_text, area, google_maps_url, notes, selected_tags, status'
    )
    .eq('id', id)
    .maybeSingle();

  if (res.error) {
    return null;
  }

  return (res.data ?? null) as PendingCafeSuggestion | null;
}

export async function fetchPendingPhotoSubmissions(): Promise<PendingPhotoSubmission[]> {
  const res = await supabase
    .from('cafe_photos')
    .select('id, created_at, cafe_id, storage_path, caption')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (res.error) {
    return [];
  }

  const rows = (res.data ?? []) as {
    id: string;
    created_at: string;
    cafe_id: number;
    storage_path: string;
    caption: string | null;
  }[];

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const path = row.storage_path?.trim();
      if (!path) {
        return { ...row, preview_url: null } satisfies PendingPhotoSubmission;
      }
      const signed = await supabase.storage.from(CAFE_USER_PHOTO_BUCKET).createSignedUrl(path, 60 * 20);
      return {
        ...row,
        preview_url: signed.data?.signedUrl ?? null,
      } satisfies PendingPhotoSubmission;
    })
  );

  return withUrls;
}

export async function reviewCafeSuggestion(
  id: string,
  decision: 'approved' | 'rejected'
): Promise<SupabaseActionResult> {
  const res = await supabase
    .from('cafe_submissions')
    .update({ status: decision, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (res.error) {
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

export type LikelyCafeDuplicate = {
  id: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
};

export async function findLikelyCafeDuplicates(input: {
  name: string;
  neighborhood?: string;
  addressLine?: string;
}): Promise<LikelyCafeDuplicate[]> {
  const name = input.name.trim();
  if (!name) return [];

  const res = await supabase
    .from('cafes')
    .select('id, name, neighborhood, address_line, address')
    .ilike('name', `%${name}%`)
    .limit(12);

  if (res.error) return [];

  const neighborhood = input.neighborhood?.trim().toLowerCase() ?? '';
  const addressLine = input.addressLine?.trim().toLowerCase() ?? '';

  const rows = (res.data ?? []) as {
    id: string | number;
    name: string | null;
    neighborhood: string | null;
    address_line: string | null;
    address: string | null;
  }[];

  return rows
    .filter((row) => {
      const rowName = (row.name ?? '').trim().toLowerCase();
      if (!rowName) return false;
      const directNameMatch = rowName === name.toLowerCase() || rowName.includes(name.toLowerCase());
      if (!directNameMatch) return false;

      if (!neighborhood && !addressLine) return true;

      const rowNeighborhood = (row.neighborhood ?? '').trim().toLowerCase();
      const rowAddress = (row.address_line ?? row.address ?? '').trim().toLowerCase();
      const neighborhoodMatch = neighborhood.length > 0 && rowNeighborhood.includes(neighborhood);
      const addressMatch = addressLine.length > 0 && rowAddress.includes(addressLine);
      return neighborhoodMatch || addressMatch;
    })
    .map((row) => ({
      id: String(row.id),
      name: (row.name ?? '').trim(),
      neighborhood: row.neighborhood,
      address: row.address_line ?? row.address ?? null,
    }));
}

export type CreateCafeFromSubmissionInput = {
  submissionId: string;
  name: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  addressLine?: string;
  googleMapsUrl?: string;
  summary?: string;
  tags?: string[];
  imageUrl?: string;
};

export async function createCafeAndApproveSubmission(
  input: CreateCafeFromSubmissionInput
): Promise<{ ok: true; cafeId: string } | { ok: false; error: string }> {
  const tags = Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
  const insertPayload = {
    name: input.name.trim(),
    neighborhood: input.neighborhood.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    address_line: input.addressLine?.trim() || null,
    google_maps_url: input.googleMapsUrl?.trim() || null,
    summary: input.summary?.trim() || null,
    tags,
    image_url: input.imageUrl?.trim() || null,
  };

  const insertRes = await supabase.from('cafes').insert(insertPayload).select('id').maybeSingle();
  if (insertRes.error || !insertRes.data?.id) {
    return {
      ok: false,
      error: insertRes.error?.message ?? 'Cafe could not be created.',
    };
  }

  const createdCafeId = String(insertRes.data.id);
  const reviewRes = await supabase
    .from('cafe_submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      approved_cafe_id: createdCafeId,
    })
    .eq('id', input.submissionId)
    .eq('status', 'pending');

  if (reviewRes.error) {
    return {
      ok: false,
      error: `Cafe created (id ${createdCafeId}) but submission update failed: ${reviewRes.error.message}`,
    };
  }

  return { ok: true, cafeId: createdCafeId };
}

export async function reviewPhotoSubmission(
  id: string,
  decision: 'approved' | 'rejected'
): Promise<SupabaseActionResult> {
  const res = await supabase
    .from('cafe_photos')
    .update({ status: decision, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (res.error) {
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

