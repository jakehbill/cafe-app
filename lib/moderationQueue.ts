import {
  getApprovedCafePhotoUrls,
  parseCafeIdForPhotoQuery,
  resolveCafePhotoRowToDisplayUrl,
  type CafePhotoRowForDisplay,
} from '@/lib/cafePhotoSubmissions';
import { supabase, type SupabaseActionResult } from '@/lib/supabase';
import { generateUniqueCafeSlug } from '@/lib/cafeSlug';
import {
  promoteApprovedCafePhotoToLive,
  promoteSubmissionPhotosToLiveCafe,
} from '@/lib/promoteCafeSubmissionPhotos';
import { promoteSubmitterContributionOnCafeApproval } from '@/lib/submissionContributorPromotion';
import { resolveToCanonicalTagSlug } from '@/lib/tagRegistry';
import { normalizeVenueType } from '@/lib/venueTypes';

const CAFE_USER_PHOTO_BUCKET = 'cafe-user-photos';

export type PendingCafeSuggestion = {
  id: string;
  created_at: string;
  cafe_name: string;
  address_text: string | null;
  area: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  selected_tags: string[] | null;
  venue_type?: string | null;
  status?: string;
  submissionPhotos: {
    id: string;
    storage_path: string;
    sort_order: number | null;
    created_at: string | null;
    preview_url: string | null;
  }[];
};

export type SubmissionPhotoForModeration = {
  id: string;
  submission_id: string;
  user_id: string;
  storage_path: string;
  sort_order: number | null;
  created_at: string | null;
  preview_url: string | null;
};

export type PendingPhotoSubmission = {
  id: string;
  created_at: string;
  cafe_id: number;
  cafe_name: string | null;
  cafe_address: string | null;
  cafe_google_maps_url: string | null;
  storage_path: string;
  caption: string | null;
  preview_url: string | null;
};

export async function fetchPendingCafeSuggestions(): Promise<PendingCafeSuggestion[]> {
  const res = await supabase
    .from('cafe_submissions')
    .select(
      'id, created_at, cafe_name, address_text, area, google_maps_url, latitude, longitude, notes, selected_tags, venue_type'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (res.error) {
    return [];
  }

  const rows = (res.data ?? []) as Omit<PendingCafeSuggestion, 'submissionPhotos'>[];
  const submissionIds = rows.map((row) => String(row.id).trim()).filter((id) => id.length > 0);
  let photosBySubmissionId = new Map<
    string,
    {
      id: string;
      storage_path: string;
      sort_order: number | null;
      created_at: string | null;
      preview_url: string | null;
    }[]
  >();

  if (submissionIds.length > 0) {
    const photoRes = await supabase
      .from('cafe_submission_photos')
      .select('id, submission_id, user_id, storage_path, sort_order, created_at')
      .in('submission_id', submissionIds);

    if (!photoRes.error) {
      const rawPhotos = (photoRes.data ?? []) as {
        id: string;
        submission_id: string;
        user_id: string;
        storage_path: string;
        sort_order: number | null;
        created_at: string | null;
      }[];

      const withUrls = await Promise.all(
        rawPhotos.map(async (photo) => {
          const path = photo.storage_path?.trim();
          if (!path) {
            return { ...photo, preview_url: null };
          }
          const signed = await supabase.storage.from(CAFE_USER_PHOTO_BUCKET).createSignedUrl(path, 60 * 20);
          return { ...photo, preview_url: signed.data?.signedUrl ?? null };
        })
      );

      photosBySubmissionId = withUrls.reduce((map, photo) => {
        const key = String(photo.submission_id ?? '').trim();
        if (!key) return map;
        const current = map.get(key) ?? [];
        current.push({
          id: photo.id,
          storage_path: photo.storage_path,
          sort_order: photo.sort_order,
          created_at: photo.created_at,
          preview_url: photo.preview_url,
        });
        map.set(key, current);
        return map;
      }, new Map<string, PendingCafeSuggestion['submissionPhotos']>());

      for (const [key, photos] of photosBySubmissionId.entries()) {
        photos.sort((a, b) => {
          const sortA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
          const sortB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
          if (sortA !== sortB) return sortA - sortB;
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });
        photosBySubmissionId.set(key, photos);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    submissionPhotos: photosBySubmissionId.get(String(row.id).trim()) ?? [],
  }));
}

export async function fetchCafeSubmissionById(id: string): Promise<PendingCafeSuggestion | null> {
  const res = await supabase
    .from('cafe_submissions')
    .select(
      'id, created_at, cafe_name, address_text, area, google_maps_url, latitude, longitude, notes, selected_tags, venue_type, status'
    )
    .eq('id', id)
    .maybeSingle();

  if (res.error) {
    return null;
  }

  const row = (res.data ?? null) as Omit<PendingCafeSuggestion, 'submissionPhotos'> | null;
  if (!row) return null;
  return { ...row, submissionPhotos: [] };
}

export async function fetchSubmissionPhotosForSubmission(
  submissionId: string
): Promise<SubmissionPhotoForModeration[]> {
  const key = String(submissionId ?? '').trim();
  if (!key) return [];

  const photoRes = await supabase
    .from('cafe_submission_photos')
    .select('id, submission_id, user_id, storage_path, sort_order, created_at')
    .eq('submission_id', key);

  if (photoRes.error) return [];

  const rows = (photoRes.data ?? []) as {
    id: string;
    submission_id: string;
    user_id: string;
    storage_path: string;
    sort_order: number | null;
    created_at: string | null;
  }[];

  const withUrls = await Promise.all(
    rows.map(async (photo) => {
      const path = photo.storage_path?.trim();
      if (!path) {
        return { ...photo, preview_url: null } satisfies SubmissionPhotoForModeration;
      }
      const signed = await supabase.storage.from(CAFE_USER_PHOTO_BUCKET).createSignedUrl(path, 60 * 20);
      return { ...photo, preview_url: signed.data?.signedUrl ?? null } satisfies SubmissionPhotoForModeration;
    })
  );

  withUrls.sort((a, b) => {
    const sortA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const sortB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateA - dateB;
  });

  return withUrls;
}

export async function fetchPendingPhotoSubmissions(): Promise<PendingPhotoSubmission[]> {
  const pendingRes = await supabase
    .from('cafe_photos')
    .select('id, created_at, cafe_id, storage_path, caption, cafes(name)')
    .eq('status', 'pending')
    .eq('share_publicly', true)
    .order('created_at', { ascending: false });

  if (__DEV__ && pendingRes.error) {
    console.log('[moderationQueue] pending photos query error:', pendingRes.error.message);
  }

  if (pendingRes.error) {
    return [];
  }

  const rows = (pendingRes.data ?? []) as {
    id: string;
    created_at: string;
    cafe_id: number | string;
    storage_path: string;
    caption: string | null;
    cafes?: { name?: string | null } | null;
  }[];

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const normalizedCafeId = Number.isFinite(Number(row.cafe_id)) ? Number(row.cafe_id) : -1;
      const path = row.storage_path?.trim();
      if (!path) {
        return {
          id: row.id,
          created_at: row.created_at,
          cafe_id: normalizedCafeId,
          cafe_name: row.cafes?.name?.trim() || null,
          cafe_address: null,
          cafe_google_maps_url: null,
          storage_path: row.storage_path,
          caption: row.caption,
          preview_url: null,
        } satisfies PendingPhotoSubmission;
      }
      const signed = await supabase.storage.from(CAFE_USER_PHOTO_BUCKET).createSignedUrl(path, 60 * 20);
      return {
        id: row.id,
        created_at: row.created_at,
        cafe_id: normalizedCafeId,
        cafe_name: row.cafes?.name?.trim() || null,
        cafe_address: null,
        cafe_google_maps_url: null,
        storage_path: row.storage_path,
        caption: row.caption,
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
    .update({
      status: decision,
      moderation_status: decision,
      reviewed_at: new Date().toISOString(),
    })
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
  area: string | null;
  address: string | null;
};

export async function findLikelyCafeDuplicates(input: {
  name: string;
  area?: string;
  addressLine?: string;
}): Promise<LikelyCafeDuplicate[]> {
  const name = input.name.trim();
  if (!name) return [];

  const res = await supabase
    .from('cafes')
    .select('id, name, area, address')
    .ilike('name', `%${name}%`)
    .limit(12);

  if (res.error) return [];

  const area = input.area?.trim().toLowerCase() ?? '';
  const addressLine = input.addressLine?.trim().toLowerCase() ?? '';

  const rows = (res.data ?? []) as {
    id: string | number;
    name: string | null;
    area: string | null;
    address: string | null;
  }[];

  return rows
    .filter((row) => {
      const rowName = (row.name ?? '').trim().toLowerCase();
      if (!rowName) return false;
      const directNameMatch = rowName === name.toLowerCase() || rowName.includes(name.toLowerCase());
      if (!directNameMatch) return false;

      if (!area && !addressLine) return true;

      const rowArea = (row.area ?? '').trim().toLowerCase();
      const rowAddress = (row.address ?? '').trim().toLowerCase();
      const areaMatch = area.length > 0 && rowArea.includes(area);
      const addressMatch = addressLine.length > 0 && rowAddress.includes(addressLine);
      return areaMatch || addressMatch;
    })
    .map((row) => ({
      id: String(row.id),
      name: (row.name ?? '').trim(),
      area: row.area,
      address: row.address ?? null,
    }));
}

export type CreateCafeFromSubmissionInput = {
  submissionId: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  addressLine?: string;
  googleMapsUrl?: string;
  shortDescription?: string;
  tags?: string[];
  venueType?: string | null;
  moderatorUserId: string;
  selectedSubmissionPhotos?: SubmissionPhotoForModeration[];
};

/** Same canonical slugs as ratings/search (`cafes.tags` text[]). */
export function normalizeTagsForCafeColumn(rawTags: string[] | null | undefined): string[] {
  const slugs: string[] = [];
  for (const raw of rawTags ?? []) {
    const slug = resolveToCanonicalTagSlug(String(raw ?? '').trim());
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

async function resolveTagsForApprovedCafe(input: CreateCafeFromSubmissionInput): Promise<string[]> {
  const fromModerator = normalizeTagsForCafeColumn(input.tags);
  if (fromModerator.length > 0) return fromModerator;

  const subRes = await supabase
    .from('cafe_submissions')
    .select('selected_tags')
    .eq('id', input.submissionId)
    .maybeSingle();
  if (subRes.error) {
    return [];
  }
  return normalizeTagsForCafeColumn((subRes.data?.selected_tags ?? null) as string[] | null);
}

export async function createCafeAndApproveSubmission(
  input: CreateCafeFromSubmissionInput
): Promise<{ ok: true; cafeId: string } | { ok: false; error: string }> {
  if (!input.moderatorUserId?.trim()) {
    return { ok: false, error: 'Moderator user id is required.' };
  }

  const tags = await resolveTagsForApprovedCafe(input);
  const selectedPhotos = input.selectedSubmissionPhotos ?? [];
  const moderatorUserId = input.moderatorUserId.trim();
  const validSelectedPhotos = (() => {
    const seenPhotoIds = new Set<string>();
    const seenPaths = new Set<string>();
    const out: SubmissionPhotoForModeration[] = [];
    for (const photo of selectedPhotos) {
      if (!photo) continue;
      const photoId = String(photo.id ?? '').trim();
      if (!photoId || seenPhotoIds.has(photoId)) continue;
      const storagePath = String(photo.storage_path ?? '').trim();
      if (!storagePath) continue;
      if (seenPaths.has(storagePath)) continue;
      seenPhotoIds.add(photoId);
      seenPaths.add(storagePath);
      out.push({ ...photo, storage_path: storagePath });
    }
    return out;
  })();
  let slug: string;
  try {
    slug = await generateUniqueCafeSlug(input.name, input.area);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Could not generate a unique slug for this cafe.',
    };
  }

  const insertPayload = {
    name: input.name.trim(),
    slug,
    area: input.area.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.addressLine?.trim() || null,
    google_maps_url: input.googleMapsUrl?.trim() || null,
    short_description: input.shortDescription?.trim() || null,
    tags,
    image_urls: [],
    venue_type: normalizeVenueType(input.venueType),
    // Approval activates the space; certification stays a manual editorial step.
    status: 'active',
    is_certified: false,
  };

  const insertRes = await supabase.from('cafes').insert(insertPayload).select('id, slug').single();
  if (insertRes.error || !insertRes.data?.id) {
    return {
      ok: false,
      error: insertRes.error?.message ?? 'Cafe could not be created.',
    };
  }

  const createdCafeId = String(insertRes.data.id);
  const createdCafeIdNum = Number(createdCafeId);

  if (validSelectedPhotos.length > 0 && Number.isFinite(createdCafeIdNum)) {
    const promoted = await promoteSubmissionPhotosToLiveCafe({
      cafeId: createdCafeId,
      photos: validSelectedPhotos.map((photo) => ({
        id: photo.id,
        user_id: String(photo.user_id ?? '').trim(),
        storage_path: String(photo.storage_path ?? '').trim(),
      })),
    });

    if (promoted.imageUrls.length > 0) {
      const cafeUpdateRes = await supabase
        .from('cafes')
        .update({ image_urls: promoted.imageUrls })
        .eq('id', createdCafeId);
      if (cafeUpdateRes.error) {
        console.warn(
          '[createCafeAndApproveSubmission] cafe created but image_urls update failed:',
          cafeUpdateRes.error.message
        );
      }
    }

    if (promoted.cafePhotoRows.length > 0) {
      const photoInsertRes = await supabase.from('cafe_photos').insert(promoted.cafePhotoRows);
      if (photoInsertRes.error) {
        console.warn(
          '[createCafeAndApproveSubmission] cafe created but cafe_photos insert failed:',
          photoInsertRes.error.message
        );
      }
    }

    if (promoted.errors.length > 0 && promoted.imageUrls.length === 0) {
      console.warn(
        '[createCafeAndApproveSubmission] no photos promoted to live café:',
        promoted.errors
      );
    }
  }

  const reviewRes = await supabase
    .from('cafe_submissions')
    .update({
      status: 'approved',
      moderation_status: 'approved',
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

  await supabase
    .from('user_cafe_visits')
    .update({ cafe_id: createdCafeId, submission_id: null })
    .eq('submission_id', input.submissionId);

  await promoteSubmitterContributionOnCafeApproval({
    submissionId: input.submissionId,
    cafeId: createdCafeId,
  });

  const linkedPublicVisits = await supabase
    .from('user_cafe_visits')
    .select('id, user_id, note, is_public')
    .eq('cafe_id', createdCafeId)
    .eq('is_public', true);
  const linkedRows = linkedPublicVisits.data ?? [];
  const visitIds = linkedRows.map((visit) => String(visit.id)).filter(Boolean);
  const visitPhotosRes = visitIds.length
    ? await supabase
        .from('visit_photos')
        .select('visit_id, storage_path, sort_order, is_public, public_status, share_publicly')
        .in('visit_id', visitIds)
        .eq('share_publicly', true)
    : { data: [], error: null };
  const visitPhotosByVisitId = new Map<string, string[]>();
  const rows = (visitPhotosRes.data ?? []) as {
    visit_id: string;
    storage_path: string | null;
    sort_order: number | null;
    is_public: boolean | null;
    public_status: string | null;
    share_publicly: boolean | null;
  }[];
  rows
    .sort((a, b) => {
      const ao = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
      return ao - bo;
    })
    .forEach((row) => {
      const visitId = String(row.visit_id ?? '').trim();
      const path = String(row.storage_path ?? '').trim();
      if (!visitId || !path) return;
      const list = visitPhotosByVisitId.get(visitId) ?? [];
      list.push(path);
      visitPhotosByVisitId.set(visitId, list);
    });

  const cafePhotoRows = linkedRows.flatMap((visit) => {
    const paths = visitPhotosByVisitId.get(String(visit.id)) ?? [];
    return paths.map((storage_path) => ({
      user_id: String(visit.user_id ?? '').trim(),
      cafe_id: Number(createdCafeId),
      storage_path,
      image_url: null as string | null,
      caption: String(visit.note ?? '').trim().slice(0, 280) || null,
      status: 'pending' as const,
      source_visit_id: String(visit.id),
      share_publicly: true,
    }));
  }).filter((row) => row.user_id && row.storage_path && Number.isFinite(row.cafe_id));
  if (cafePhotoRows.length > 0) {
    await supabase.from('cafe_photos').insert(cafePhotoRows);
  }

  return { ok: true, cafeId: createdCafeId };
}

export type ApprovedCafePhotoForModeration = {
  id: string;
  cafeId: string;
  previewUrl: string | null;
  isPrimary: boolean;
  sortOrder: number | null;
  createdAt: string;
};

/** Approved live photos for a café — moderator tools (primary picker). */
export async function fetchApprovedCafePhotosForCafe(
  cafeId: string
): Promise<ApprovedCafePhotoForModeration[]> {
  const normalizedCafeId = String(cafeId ?? '').trim();
  if (!normalizedCafeId) return [];

  const res = await supabase
    .from('cafe_photos')
    .select('id, cafe_id, image_url, storage_path, sort_order, is_primary, created_at')
    .eq('cafe_id', parseCafeIdForPhotoQuery(normalizedCafeId))
    .eq('status', 'approved')
    .order('is_primary', { ascending: false })
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (res.error) {
    console.error('[fetchApprovedCafePhotosForCafe] select failed:', res.error.message);
    return [];
  }

  const rows = (res.data ?? []) as (CafePhotoRowForDisplay & {
    id: string;
    cafe_id: number | string;
    created_at: string;
  })[];

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const previewUrl = await resolveCafePhotoRowToDisplayUrl(row);
      return {
        id: String(row.id),
        cafeId: String(row.cafe_id ?? normalizedCafeId),
        previewUrl,
        isPrimary: row.is_primary === true,
        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : null,
        createdAt: String(row.created_at ?? ''),
      } satisfies ApprovedCafePhotoForModeration;
    })
  );

  return withUrls.filter((row) => Boolean(row.previewUrl));
}

/**
 * Mark one approved photo as the café primary image.
 * Clears `is_primary` on sibling rows and reorders `cafes.image_urls` (primary first).
 */
export async function setCafePrimaryPhoto(photoId: string): Promise<SupabaseActionResult> {
  const key = String(photoId ?? '').trim();
  if (!key) return { ok: false, error: 'Photo id is required.' };

  const rowRes = await supabase
    .from('cafe_photos')
    .select('id, cafe_id, image_url, storage_path, status, is_primary')
    .eq('id', key)
    .eq('status', 'approved')
    .maybeSingle();

  if (rowRes.error) return { ok: false, error: rowRes.error.message };
  const row = rowRes.data as {
    id: string;
    cafe_id: number | string;
    image_url: string | null;
    storage_path: string | null;
    status: string;
    is_primary: boolean | null;
  } | null;
  if (!row) {
    return { ok: false, error: 'Approved photo not found.' };
  }

  const cafeId = String(row.cafe_id ?? '').trim();
  const cafeIdQuery = parseCafeIdForPhotoQuery(cafeId);
  const publicUrl = await resolveCafePhotoRowToDisplayUrl(row);
  if (!publicUrl) {
    return { ok: false, error: 'Photo has no usable public image URL.' };
  }

  const clearRes = await supabase
    .from('cafe_photos')
    .update({ is_primary: false })
    .eq('cafe_id', cafeIdQuery)
    .eq('status', 'approved');
  if (clearRes.error) return { ok: false, error: clearRes.error.message };

  const setRes = await supabase
    .from('cafe_photos')
    .update({ is_primary: true, sort_order: 0 })
    .eq('id', key)
    .eq('status', 'approved');
  if (setRes.error) return { ok: false, error: setRes.error.message };

  const siblingRes = await supabase
    .from('cafe_photos')
    .select('id')
    .eq('cafe_id', cafeIdQuery)
    .eq('status', 'approved')
    .neq('id', key)
    .order('created_at', { ascending: true });
  if (!siblingRes.error) {
    const siblings = siblingRes.data ?? [];
    await Promise.all(
      siblings.map((sibling, index) =>
        supabase
          .from('cafe_photos')
          .update({ sort_order: index + 1 })
          .eq('id', String((sibling as { id: string }).id))
      )
    );
  }

  const orderedUrls = await getApprovedCafePhotoUrls(cafeId);
  const nextImageUrls =
    orderedUrls.length > 0
      ? orderedUrls
      : [publicUrl];

  const cafeUpdateRes = await supabase
    .from('cafes')
    .update({ image_urls: nextImageUrls })
    .eq('id', cafeId);
  if (cafeUpdateRes.error) {
    console.warn('[setCafePrimaryPhoto] cafes.image_urls update failed:', cafeUpdateRes.error.message);
  }

  return { ok: true };
}

export async function reviewPhotoSubmission(
  id: string,
  decision: 'approved' | 'rejected',
  options?: { setAsPrimary?: boolean }
): Promise<SupabaseActionResult> {
  if (decision === 'rejected') {
    const res = await supabase
      .from('cafe_photos')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending');

    if (res.error) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }

  const promoted = await promoteApprovedCafePhotoToLive({
    photoId: id,
    setAsPrimary: options?.setAsPrimary === true,
  });
  if (!promoted.ok) {
    return { ok: false, error: promoted.error };
  }

  return { ok: true };
}

