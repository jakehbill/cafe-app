import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Cafe } from '@/data/cafes';
import { AUTH_REQUIRED_MESSAGE } from '@/lib/authGate';
import { normalizeCoffeeRatingInput, quantizeCoffeeRatingForStorage } from '@/lib/coffeeRating';
import { parseCafeTagsField } from '@/lib/cafeTags';

export { quantizeCoffeeRatingForStorage } from '@/lib/coffeeRating';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Cross-platform auth storage:
    // - native: AsyncStorage
    // - web: localStorage (AsyncStorage is not available on web)
    storage:
      Platform.OS === 'web'
        ? {
            getItem: async (key: string) => {
              if (typeof window === 'undefined') return null;
              return window.localStorage.getItem(key);
            },
            setItem: async (key: string, value: string) => {
              if (typeof window === 'undefined') return;
              window.localStorage.setItem(key, value);
            },
            removeItem: async (key: string) => {
              if (typeof window === 'undefined') return;
              window.localStorage.removeItem(key);
            },
          }
        : // Import lazily so web bundles don't try to load native storage.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@react-native-async-storage/async-storage').default,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type SupabaseActionResult = { ok: true } | { ok: false; error: string };

const topTagsCache = new Map<string, string[]>();

/**
 * Save a cafe for the current user (writes 1 row to `saves`).
 * Returns a simple success/failure result so UI can react.
 */
export async function saveCafe(cafeId: number): Promise<SupabaseActionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('saveCafe: auth getUser failed:', authError);
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const res = await supabase.from('saves').insert({ cafe_id: cafeId, user_id: userId });
  if (res.error) {
    console.error('saveCafe: insert failed:', res.error);
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

/**
 * Unsave a cafe for the current user (deletes from `saves` by cafe_id + user_id).
 * Returns a simple success/failure result so UI can react.
 */
export async function unsaveCafe(cafeId: number): Promise<SupabaseActionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('unsaveCafe: auth getUser failed:', authError);
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const res = await supabase.from('saves').delete().eq('user_id', userId).eq('cafe_id', cafeId);
  if (res.error) {
    console.error('unsaveCafe: delete failed:', res.error);
    return { ok: false, error: res.error.message };
  }

  return { ok: true };
}

/**
 * Upsert `public.ratings` + `rating_tags` for a user/cafe pair (same path as rate screen).
 * Used by rate flow and moderation approval when promoting a submitter’s first contribution.
 */
export async function upsertCoffeeRatingForUser(params: {
  userId: string;
  cafeId: number;
  coffee: number;
  tags?: string[];
}): Promise<SupabaseActionResult> {
  const userId = String(params.userId ?? '').trim();
  if (!userId) {
    return { ok: false, error: 'user_id is required.' };
  }
  if (!Number.isFinite(params.cafeId)) {
    return { ok: false, error: 'Invalid cafe_id for ratings.' };
  }

  const coffeeRating = quantizeCoffeeRatingForStorage(params.coffee);
  const ratingPayload = {
    user_id: userId,
    cafe_id: params.cafeId,
    coffee_rating: coffeeRating,
  };

  const upsertRes = await supabase
    .from('ratings')
    .upsert(ratingPayload, { onConflict: 'user_id,cafe_id' })
    .select('id');

  if (upsertRes.error) {
    console.error('[upsertCoffeeRatingForUser] ratings upsert failed:', upsertRes.error);
    return { ok: false, error: upsertRes.error.message };
  }

  let ratingId: number | string | undefined = upsertRes.data?.[0]?.id;
  if (ratingId == null) {
    const fetchRes = await supabase
      .from('ratings')
      .select('id')
      .eq('user_id', userId)
      .eq('cafe_id', params.cafeId)
      .maybeSingle();
    ratingId = fetchRes.data?.id;
    if (fetchRes.error) {
      return { ok: false, error: fetchRes.error.message };
    }
  }

  if (ratingId == null) {
    return { ok: false, error: 'Ratings upsert did not return a rating id.' };
  }

  const deleteTagsRes = await supabase.from('rating_tags').delete().eq('rating_id', ratingId);
  if (deleteTagsRes.error) {
    return { ok: false, error: deleteTagsRes.error.message };
  }

  const normalizedTags = Array.from(new Set((params.tags ?? []).map((t) => t.trim()).filter(Boolean)));
  if (normalizedTags.length > 0) {
    const tagRows = normalizedTags.map((tag) => ({ rating_id: ratingId, tag }));
    const insertTagsRes = await supabase.from('rating_tags').insert(tagRows);
    if (insertTagsRes.error) {
      return { ok: false, error: insertTagsRes.error.message };
    }
  }

  return { ok: true };
}

/**
 * Create or update a cafe rating for the current user.
 * Writes only `coffee_rating` on `public.ratings` (no `rating`, `work_rating`, or `vibe_rating`).
 * Replaces rows in `public.rating_tags` for that rating.
 */
export async function rateCafe(
  cafeId: string | number,
  input: {
    coffee: number;
    tags?: string[];
    notes?: string;
  }
): Promise<SupabaseActionResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('rateCafe: auth getUser failed:', authError);
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: AUTH_REQUIRED_MESSAGE };
  }

  const normalizedCafeId = Number.parseInt(String(cafeId), 10);
  if (!Number.isFinite(normalizedCafeId)) {
    const message = `Invalid cafe_id for ratings submit: ${String(cafeId)}`;
    console.error('rateCafe:', message);
    return { ok: false, error: message };
  }

  return upsertCoffeeRatingForUser({
    userId,
    cafeId: normalizedCafeId,
    coffee: input.coffee,
    tags: input.tags,
  });
}

/**
 * Coffee-only helper for rate-screen prefill from `user_cafe_ratings`.
 */
export async function getUserCoffeeRating(cafeId: number | string): Promise<number | null> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('getUserCoffeeRating: auth getUser failed:', authError);
    return null;
  }

  const userId = data.user?.id;
  if (!userId) {
    return null;
  }

  const normalizedCafeId = Number.parseInt(String(cafeId), 10);
  if (!Number.isFinite(normalizedCafeId)) {
    return null;
  }

  const res = await supabase
    .from('ratings')
    .select('coffee_rating')
    .eq('user_id', userId)
    .eq('cafe_id', normalizedCafeId)
    .maybeSingle();

  if (res.error) {
    console.error('getUserCoffeeRating: select failed:', res.error);
    return null;
  }

  const raw = res.data?.coffee_rating;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  return quantizeCoffeeRatingForStorage(raw);
}

/**
 * Returns top tags for one cafe, aggregated from `rating_tags` joined through `ratings`.
 * Caches the full popularity-ordered list so different callers can request up to N tags.
 */
function isNumericCafeId(cafeId: string): boolean {
  return /^\d+$/.test(String(cafeId ?? '').trim());
}

async function getCafeTagsFromCatalogRow(cafeId: string, limit: number): Promise<string[]> {
  const res = await supabase.from('cafes').select('tags').eq('id', cafeId).maybeSingle();
  if (res.error || !res.data) {
    const fallback = await supabase.from('cafes').select('*').eq('id', cafeId).maybeSingle();
    if (fallback.error || !fallback.data) return [];
    const row = fallback.data as Record<string, unknown>;
    return parseCafeTagsField(row.tags ?? row.tag_slugs ?? row.tag_list).slice(0, limit);
  }
  return parseCafeTagsField((res.data as { tags?: unknown }).tags).slice(0, limit);
}

/**
 * Tags for café cards/detail: editorial `cafes.tags` first (approved submissions), then community ratings.
 */
export async function resolveCafeDisplayTags(cafe: Cafe, limit = 3): Promise<string[]> {
  const fromCatalog = parseCafeTagsField(cafe.tags).slice(0, limit);
  if (fromCatalog.length > 0) return fromCatalog;
  return getTopCafeTags(cafe.id, limit);
}

export async function getTopCafeTags(cafeId: string, limit = 3): Promise<string[]> {
  const cached = topTagsCache.get(cafeId);
  if (cached) return cached.slice(0, limit);

  if (!isNumericCafeId(cafeId)) {
    return getCafeTagsFromCatalogRow(cafeId, limit);
  }

  const numericCafeId = Number.parseInt(cafeId, 10);

  const ratingsRes = await supabase
    .from('ratings')
    .select('id')
    .eq('cafe_id', numericCafeId);
  if (ratingsRes.error) {
    console.error('getTopCafeTags: ratings fetch failed:', ratingsRes.error);
    return getCafeTagsFromCatalogRow(cafeId, limit);
  }

  const ratingIds = (ratingsRes.data ?? []).map((row) => row.id).filter((id): id is number => typeof id === 'number');
  if (ratingIds.length === 0) {
    const catalogTags = await getCafeTagsFromCatalogRow(cafeId, limit);
    if (catalogTags.length > 0) topTagsCache.set(cafeId, catalogTags);
    return catalogTags;
  }

  const tagsRes = await supabase
    .from('rating_tags')
    .select('tag,rating_id')
    .in('rating_id', ratingIds);
  if (tagsRes.error) {
    console.error('getTopCafeTags: rating_tags fetch failed:', tagsRes.error);
    return getCafeTagsFromCatalogRow(cafeId, limit);
  }

  const counts = new Map<string, number>();
  for (const row of tagsRes.data ?? []) {
    const tag = typeof row.tag === 'string' ? row.tag.trim() : '';
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const sortedTags = [...counts.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .map(([tag]) => tag);

  if (sortedTags.length === 0) {
    const catalogTags = await getCafeTagsFromCatalogRow(cafeId, limit);
    if (catalogTags.length > 0) topTagsCache.set(cafeId, catalogTags);
    return catalogTags;
  }

  topTagsCache.set(cafeId, sortedTags);
  return sortedTags.slice(0, limit);
}

/** Community line: share of ratings that included the most-picked tag (real data from `rating_tags`). */
export type CafeCommunityTagInsight = {
  totalRatings: number;
  /** % of ratings that include at least one pick of this tag */
  percent: number;
  tag: string;
};

export type CafeRecentReview = {
  note: string;
  rating: number | null;
  tags: string[];
  createdAt: string | null;
};

export type PublicVisitNote = {
  /** Present when RPC returns `visit_id` (needed for moderator hide). */
  visitId?: string | null;
  cafeId: string | null;
  cafeSlug: string | null;
  cafeName: string;
  cafeArea: string | null;
  note: string;
  createdAt: string;
  /** Resolved from RPC row and/or `get_hidden_bulletin_entries`; used for final filtering. */
  hiddenFromBulletin?: boolean;
};

type HiddenBulletinEntry = {
  visitId: string;
  cafeId: string;
  note: string;
  createdAt: string;
};

/** Session cache of hidden visit ids (filled from RPC and after successful X hide). */
let bulletinHiddenVisitIdCache = new Set<string>();

export type HideBulletinVisitPayload = {
  table: 'user_cafe_visits';
  id: string;
  hidden_from_bulletin: true;
};

/**
 * Same path as the Bulletin X button: sets `user_cafe_visits.hidden_from_bulletin = true`.
 */
export async function hideBulletinVisit(visitId: string): Promise<SupabaseActionResult> {
  const id = String(visitId ?? '').trim();
  if (!id) {
    return { ok: false, error: 'Missing visit id.' };
  }

  const payload: HideBulletinVisitPayload = {
    table: 'user_cafe_visits',
    id,
    hidden_from_bulletin: true,
  };

  if (__DEV__) {
    console.log('[Bulletin hide] update payload:', payload);
  }

  const res = await supabase.from(payload.table).update({ hidden_from_bulletin: true }).eq('id', id);

  if (res.error) {
    console.error('[Bulletin hide] update failed:', res.error.message, { payload, error: res.error });
    return { ok: false, error: res.error.message };
  }

  bulletinHiddenVisitIdCache.add(parseBulletinVisitId({ id, visit_id: id }));
  if (__DEV__) {
    console.log('[Bulletin hide] update ok — row hidden in user_cafe_visits', payload);
  }
  return { ok: true };
}

/** Hide only when explicitly true (false and null stay visible). */
export function isBulletinHiddenFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 't' || normalized === '1';
  }
  return false;
}

function parseBulletinVisitId(row: Record<string, unknown>): string {
  return String((row as { visit_id?: unknown }).visit_id ?? (row as { id?: unknown }).id ?? '')
    .trim()
    .toLowerCase();
}

function parseBulletinHiddenFlag(row: Record<string, unknown>): boolean {
  const rowAny = row as { hidden_from_bulletin?: unknown; hiddenFromBulletin?: unknown };
  return isBulletinHiddenFlag(rowAny.hidden_from_bulletin ?? rowAny.hiddenFromBulletin);
}

function normalizeBulletinTimestamp(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString();
}

async function loadHiddenBulletinVisitIds(): Promise<{
  visitIds: Set<string>;
  entries: HiddenBulletinEntry[];
  hiddenRpcAvailable: boolean;
}> {
  const hiddenRes = await supabase.rpc('get_hidden_bulletin_entries');
  if (hiddenRes.error) {
    console.error(
      '[Bulletin] RPC get_hidden_bulletin_entries missing — manual Supabase hides will not apply until you run supabase/bulletin_hide_from_bulletin.sql:',
      hiddenRes.error.message
    );
    return {
      visitIds: new Set(bulletinHiddenVisitIdCache),
      entries: [],
      hiddenRpcAvailable: false,
    };
  }

  const entries = ((hiddenRes.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const visitId = parseBulletinVisitId(row);
      const cafeId = String((row as { cafe_id?: unknown }).cafe_id ?? '').trim();
      const note = String((row as { note?: unknown }).note ?? '').trim();
      const createdAt = normalizeBulletinTimestamp((row as { created_at?: unknown }).created_at);
      if (!visitId || !note) return null;
      return { visitId, cafeId, note, createdAt } satisfies HiddenBulletinEntry;
    })
    .filter((row): row is HiddenBulletinEntry => row != null);

  const visitIds = new Set(entries.map((entry) => entry.visitId));
  for (const cachedId of bulletinHiddenVisitIdCache) {
    visitIds.add(cachedId);
  }
  bulletinHiddenVisitIdCache = visitIds;

  if (__DEV__) {
    console.log('[Bulletin] hidden visit ids from DB:', [...visitIds]);
  }

  return { visitIds, entries, hiddenRpcAvailable: true };
}

function feedRpcLooksLegacy(rows: Array<Record<string, unknown>>): boolean {
  if (rows.length === 0) return false;
  const first = rows[0]!;
  const hasLegacyId = parseBulletinVisitId(first).length > 0 && first.visit_id == null;
  const lacksHiddenColumn = !Object.prototype.hasOwnProperty.call(first, 'hidden_from_bulletin');
  return hasLegacyId && lacksHiddenColumn;
}

function isPublicVisitNoteHidden(
  item: Pick<PublicVisitNote, 'visitId' | 'cafeId' | 'note' | 'createdAt' | 'hiddenFromBulletin'>,
  hiddenEntries: HiddenBulletinEntry[]
): boolean {
  if (item.hiddenFromBulletin === true) return true;

  const visitId = parseBulletinVisitId({ visit_id: item.visitId, id: item.visitId });
  const cafeId = String(item.cafeId ?? '').trim();
  const note = String(item.note ?? '').trim();
  const createdAt = normalizeBulletinTimestamp(item.createdAt);

  return hiddenEntries.some((hidden) => {
    const hiddenVisitId = parseBulletinVisitId({ visit_id: hidden.visitId, id: hidden.visitId });
    if (visitId && hiddenVisitId && visitId === hiddenVisitId) return true;
    if (!note || note !== hidden.note) return false;
    if (!cafeId || !hidden.cafeId || cafeId !== hidden.cafeId) return false;
    if (!createdAt || !hidden.createdAt || createdAt !== hidden.createdAt) return false;
    return true;
  });
}

/**
 * Best tag for “X% of people rate this for Y” — uses the most common tag among
 * `rating_tags` rows for this cafe’s ratings; % = ratings that include that tag / total ratings.
 */
export async function getCafeCommunityTagInsight(cafeId: string): Promise<CafeCommunityTagInsight | null> {
  const numericCafeId = Number.parseInt(cafeId, 10);
  if (!Number.isFinite(numericCafeId)) return null;

  const ratingsRes = await supabase
    .from('ratings')
    .select('id')
    .eq('cafe_id', numericCafeId);
  if (ratingsRes.error) {
    console.error('getCafeCommunityTagInsight: ratings fetch failed:', ratingsRes.error);
    return null;
  }

  const ratingIds = (ratingsRes.data ?? []).map((row) => row.id).filter((id): id is number => typeof id === 'number');
  const totalRatings = ratingIds.length;
  if (totalRatings === 0) return null;

  const tagsRes = await supabase
    .from('rating_tags')
    .select('tag,rating_id')
    .in('rating_id', ratingIds);
  if (tagsRes.error) {
    console.error('getCafeCommunityTagInsight: rating_tags fetch failed:', tagsRes.error);
    return null;
  }

  const tagToRatings = new Map<string, Set<number>>();
  for (const row of tagsRes.data ?? []) {
    const rid = typeof row.rating_id === 'number' ? row.rating_id : null;
    const tag = typeof row.tag === 'string' ? row.tag.trim() : '';
    if (rid == null || !tag) continue;
    if (!tagToRatings.has(tag)) tagToRatings.set(tag, new Set());
    tagToRatings.get(tag)!.add(rid);
  }

  let bestTag = '';
  let bestCount = 0;
  for (const [tag, set] of tagToRatings) {
    if (set.size > bestCount) {
      bestCount = set.size;
      bestTag = tag;
    }
  }

  if (!bestTag || bestCount === 0) return null;

  const percent = Math.min(100, Math.max(0, Math.round((bestCount / totalRatings) * 100)));
  return { totalRatings, percent, tag: bestTag };
}

/**
 * Most recent user-written notes for one cafe (UGC review snippets).
 * Pulls from `user_cafe_visits` and returns up to `limit` non-empty notes.
 */
export async function getRecentCafeReviews(cafeId: string, limit = 5): Promise<CafeRecentReview[]> {
  const numericCafeId = Number.parseInt(String(cafeId).trim(), 10);
  if (!Number.isFinite(numericCafeId)) return [];
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));

  const res = await supabase
    .from('user_cafe_visits')
    .select('note, rating, tags, created_at')
    .eq('cafe_id', numericCafeId)
    .not('note', 'is', null)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (res.error) {
    console.error('getRecentCafeReviews failed:', res.error);
    return [];
  }

  return (res.data ?? [])
    .map((row) => {
      const note = String((row as { note?: unknown }).note ?? '').trim();
      if (!note) return null;
      const ratingRaw = (row as { rating?: unknown }).rating;
      const rating =
        typeof ratingRaw === 'number' && Number.isFinite(ratingRaw)
          ? normalizeCoffeeRatingInput(ratingRaw)
          : null;
      const tagsRaw = (row as { tags?: unknown }).tags;
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0).slice(0, 3)
        : [];
      const createdAt = String((row as { created_at?: unknown }).created_at ?? '').trim() || null;
      return {
        note,
        rating,
        tags,
        createdAt,
      } satisfies CafeRecentReview;
    })
    .filter((row): row is CafeRecentReview => row != null)
    .slice(0, safeLimit);
}

/**
 * Public Beaned Bulletin feed.
 *
 * Source (live Supabase, verified):
 * - RPC `get_recent_public_visit_notes` → `user_cafe_visits` (+ `cafes` join in newer SQL)
 * - Legacy RPC rows use `id` (not `visit_id`) and omit `hidden_from_bulletin`
 * - Backup filter RPC `get_hidden_bulletin_entries` (security definer; required for legacy feed)
 *
 * Not used for Home: `lib/bulletinItems.ts`, `bulletin_items`, `get_recent_bulletin_feed`.
 */
export async function getRecentPublicVisitNotes(limit = 5): Promise<PublicVisitNote[]> {
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const rpcFetchLimit = Math.min(30, Math.max(safeLimit * 4, safeLimit + 5));

  const rpcRes = await supabase.rpc('get_recent_public_visit_notes', { p_limit: rpcFetchLimit });
  if (rpcRes.error) {
    console.error(
      '[Bulletin] RPC get_recent_public_visit_notes failed:',
      rpcRes.error.message,
      rpcRes.error
    );
    return [];
  }

  const rawRows = (rpcRes.data ?? []) as Array<Record<string, unknown>>;
  const legacyFeedRpc = feedRpcLooksLegacy(rawRows);
  if (legacyFeedRpc) {
    console.warn(
      '[Bulletin] Feed RPC is legacy (returns `id`, not `visit_id`; no hidden_from_bulletin). Run supabase/bulletin_hide_from_bulletin.sql to filter at source.'
    );
  }

  const { visitIds: hiddenVisitIds, entries: hiddenEntries, hiddenRpcAvailable } =
    await loadHiddenBulletinVisitIds();

  if (!hiddenRpcAvailable && legacyFeedRpc && __DEV__) {
    console.warn(
      '[Bulletin] X hide updates user_cafe_visits.hidden_from_bulletin but reload cannot filter until get_hidden_bulletin_entries RPC is deployed.'
    );
  }

  const parsed = rawRows
    .map((row: Record<string, unknown>) => {
      const visitId = parseBulletinVisitId(row);
      const cafeIdRaw = String((row as { cafe_id?: unknown }).cafe_id ?? '').trim();
      const cafeSlug = String((row as { cafe_slug?: unknown }).cafe_slug ?? '').trim();
      const cafeName = String((row as { cafe_name?: unknown }).cafe_name ?? '').trim();
      const cafeArea = String((row as { cafe_area?: unknown }).cafe_area ?? '').trim();
      const note = String((row as { note?: unknown }).note ?? '').trim();
      const createdAt = normalizeBulletinTimestamp((row as { created_at?: unknown }).created_at);
      if (!note || !createdAt) return null;

      const hiddenFromBulletin =
        parseBulletinHiddenFlag(row) || (visitId ? hiddenVisitIds.has(visitId) : false);

      const item: PublicVisitNote = {
        cafeId: cafeIdRaw || null,
        cafeSlug: cafeSlug || null,
        cafeName: cafeName || 'Cafe',
        cafeArea: cafeArea || null,
        note,
        createdAt,
        hiddenFromBulletin,
      };
      if (visitId) item.visitId = visitId;
      return item;
    })
    .filter((row): row is PublicVisitNote => row != null);

  const visible = parsed
    .filter((item) => item.hiddenFromBulletin !== true && !isPublicVisitNoteHidden(item, hiddenEntries))
    .map((item) => {
      const { hiddenFromBulletin: _hidden, ...rest } = item;
      return rest;
    })
    .slice(0, safeLimit);

  return visible;
}

