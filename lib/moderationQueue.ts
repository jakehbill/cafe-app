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

