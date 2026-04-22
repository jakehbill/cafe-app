import type { Cafe } from '@/data/cafes';
import { rawPublicCoffeeToOutOf5 } from '@/lib/publicCoffeeDisplay';
import { supabase } from '@/lib/supabase';

/** Set to false to silence temporary catalog debug logs after fixing Supabase. */
const DEBUG_CAFE_CATALOG = true;

function debugCatalog(label: string, payload: Record<string, unknown>) {
  if (!DEBUG_CAFE_CATALOG || !__DEV__) return;
  try {
    console.log(`[DEBUG cafeCatalog] ${label}\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log(`[DEBUG cafeCatalog] ${label}`, payload);
  }
}

function debugCatalogFlow(payload: Record<string, unknown>) {
  if (!__DEV__) return;
  try {
    console.log(`[DEBUG catalog flow: cafes → map → UI]\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log('[DEBUG catalog flow: cafes → map → UI]', payload);
  }
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

/**
 * Parses multi-photo fields from `cafes` rows.
 * Primary source is `image_urls` (text[]), with legacy aliases as safe fallback.
 */
function imageUrlsFromRow(row: Record<string, unknown>): string[] {
  const raw = row.image_urls ?? row.gallery_urls ?? row.photo_urls ?? row.photos;
  if (Array.isArray(raw)) {
    return raw.map((x) => str(x).trim()).filter((s) => s.length > 0);
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) {
        return p.map((x) => str(x).trim()).filter((s) => s.length > 0);
      }
    } catch {
      /* not JSON */
    }
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

function tagsFromRow(row: Record<string, unknown>): string[] {
  const t = row.tags ?? row.tag_list ?? row.tag_slugs;
  if (Array.isArray(t)) return t.map((x) => String(x));
  if (typeof t === 'string' && t.trim().length > 0) {
    try {
      const p = JSON.parse(t) as unknown;
      if (Array.isArray(p)) return p.map((x) => String(x));
    } catch {
      /* not JSON — ignore */
    }
  }
  return [];
}

/**
 * Work/vibe from `cafes` listing columns only. Coffee is not read from legacy cafe columns —
 * it comes solely from `public.cafe_public_scores` via `mergePublicIntoCafe` (`coffeeScore` for ranking).
 */
function scoreTriple(row: Record<string, unknown>): { coffee: number; work: number; vibe: number } {
  const w = num(row.work_score ?? row.workScore);
  const v = num(row.vibe_score ?? row.vibeScore ?? row.atmosphere_score);
  return { coffee: 0, work: w, vibe: v };
}

/** Map public aggregate to ~0–10 so existing ranking blends stay on the same scale as work/vibe. */
function internalCoffeeScoreFromPublic(publicCoffee: number | null | undefined): number {
  const n = rawPublicCoffeeToOutOf5(publicCoffee);
  if (n == null) return 0;
  return n * 2;
}

/**
 * Maps a row from `public.cafes` to the app `Cafe` shape.
 * Supports snake_case (typical Supabase) or camelCase column names.
 */
export function mapCafeRowToCafe(row: Record<string, unknown>): Cafe | null {
  const idRaw = row.id ?? row.cafe_id;
  if (idRaw == null) return null;
  const id = String(idRaw);

  const saves = row.community_saves ?? row.communitySaves ?? row.saves_count ?? row.save_count;
  const visits = row.community_visits ?? row.communityVisits ?? row.visits_count ?? row.visit_count;
  let communityStats: Cafe['communityStats'] | undefined;
  if (typeof saves === 'number' && typeof visits === 'number') {
    communityStats = { saves, visits };
  }

  const { coffee, work, vibe } = scoreTriple(row);
  const legacyImageRaw = row.image_url ?? row.photo_url ?? row.cover_image_url ?? row.image ?? row.thumbnail_url;
  const legacySingle = str(legacyImageRaw).trim();
  const fromGallery = imageUrlsFromRow(row);
  const photoUrls =
    fromGallery.length > 0 ? fromGallery : legacySingle.length > 0 ? [legacySingle] : [];
  const primaryUrl = photoUrls[0] ?? '';
  const addressRaw = str(
    row.address ?? row.formatted_address ?? row.street_address ?? row.full_address ?? ''
  ).trim();

  const googleMapsUrl = str(
    row.google_maps_url ?? row.googleMapsUrl ?? row.google_maps_link ?? row.maps_url
  ).trim();

  return {
    id,
    name: str(row.name ?? row.title),
    neighborhood: str(row.neighborhood ?? row.area ?? row.location ?? row.district),
    latitude: num(row.latitude ?? row.lat),
    longitude: num(row.longitude ?? row.lng),
    coffeeScore: coffee,
    workScore: work,
    vibeScore: vibe,
    publicCoffeeScore: null,
    coffeeRatingCount: 0,
    tags: tagsFromRow(row),
    summary: str(row.summary ?? row.short_description ?? row.description),
    ...(googleMapsUrl.length > 0 ? { googleMapsUrl } : {}),
    ...(primaryUrl.length > 0
      ? photoUrls.length > 1
        ? { imageUrl: primaryUrl, imageUrls: photoUrls }
        : { imageUrl: primaryUrl }
      : {}),
    ...(addressRaw.length > 0 ? { addressLine: addressRaw } : {}),
    communityStats,
  };
}

export type CafePublicScoreRow = {
  publicCoffeeScore: number | null;
  coffeeRatingCount: number;
};

function parsePublicScoreRow(row: unknown): CafePublicScoreRow | null {
  if (row == null || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = r.cafe_id;
  if (id == null) return null;
  const raw = r.public_coffee_score ?? r.publicCoffeeScore;
  let publicCoffeeScore: number | null = null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    publicCoffeeScore = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) publicCoffeeScore = n;
  }
  const cntRaw = r.coffee_rating_count ?? r.coffeeRatingCount;
  const coffeeRatingCount =
    typeof cntRaw === 'number' && Number.isFinite(cntRaw) ? Math.max(0, Math.floor(cntRaw)) : 0;

  return { publicCoffeeScore, coffeeRatingCount };
}

function mergePublicIntoCafe(cafe: Cafe, row: CafePublicScoreRow | null): Cafe {
  if (row == null) {
    return {
      ...cafe,
      publicCoffeeScore: null,
      coffeeRatingCount: 0,
      coffeeScore: 0,
    };
  }
  return {
    ...cafe,
    publicCoffeeScore: row.publicCoffeeScore,
    coffeeRatingCount: row.coffeeRatingCount,
    coffeeScore: internalCoffeeScoreFromPublic(row.publicCoffeeScore),
  };
}

/**
 * `cafe_public_scores.cafe_id` may align with `cafes.cafe_id` while `mapCafeRowToCafe` uses `id ?? cafe_id`
 * (PK wins). Bulk merge used to only `pubMap.get(base.id)`, missing rows keyed by the other column — detail
 * could still match via a direct `eq('cafe_id', …)` query. Try all stable id variants from the cafe row.
 */
function resolvePublicScoreRowFromMap(
  base: Cafe,
  raw: Record<string, unknown>,
  pubMap: Map<string, CafePublicScoreRow>
): CafePublicScoreRow | null {
  const keys: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    const s = String(v).trim();
    if (s.length === 0) return;
    if (!keys.includes(s)) keys.push(s);
  };
  push(base.id);
  push(raw.cafe_id);
  push(raw.id);
  for (const k of keys) {
    const hit = pubMap.get(k);
    if (hit) return hit;
  }
  return null;
}

async function fetchPublicScoreRowForCafeBase(base: Cafe, raw: Record<string, unknown>): Promise<CafePublicScoreRow | null> {
  let pub = await fetchCafePublicScoreForId(base.id);
  if (pub != null) return pub;
  const alt = raw.cafe_id != null ? String(raw.cafe_id).trim() : '';
  if (alt.length > 0 && alt !== base.id) {
    pub = await fetchCafePublicScoreForId(alt);
  }
  return pub;
}

/** Full map of `cafe_id` → public coffee stats (from `public.cafe_public_scores`). */
export async function fetchCafePublicScoresMap(): Promise<Map<string, CafePublicScoreRow>> {
  const res = await supabase.from('cafe_public_scores').select('cafe_id, public_coffee_score, coffee_rating_count');
  if (res.error) {
    console.error('fetchCafePublicScoresMap failed:', res.error);
    return new Map();
  }
  const map = new Map<string, CafePublicScoreRow>();
  for (const row of res.data ?? []) {
    const parsed = parsePublicScoreRow(row);
    if (parsed == null) continue;
    const id = String((row as { cafe_id?: unknown }).cafe_id ?? '');
    if (id.length === 0) continue;
    map.set(id, parsed);
  }
  return map;
}

export async function fetchCafePublicScoresForIds(ids: string[]): Promise<Map<string, CafePublicScoreRow>> {
  if (ids.length === 0) return new Map();
  const res = await supabase
    .from('cafe_public_scores')
    .select('cafe_id, public_coffee_score, coffee_rating_count')
    .in('cafe_id', ids);
  if (res.error) {
    console.error('fetchCafePublicScoresForIds failed:', res.error);
    return new Map();
  }
  const map = new Map<string, CafePublicScoreRow>();
  for (const row of res.data ?? []) {
    const parsed = parsePublicScoreRow(row);
    if (parsed == null) continue;
    const id = String((row as { cafe_id?: unknown }).cafe_id ?? '');
    if (id.length === 0) continue;
    map.set(id, parsed);
  }
  return map;
}

export async function fetchCafePublicScoreForId(id: string): Promise<CafePublicScoreRow | null> {
  const res = await supabase
    .from('cafe_public_scores')
    .select('cafe_id, public_coffee_score, coffee_rating_count')
    .eq('cafe_id', id)
    .maybeSingle();
  if (res.error) {
    console.error('fetchCafePublicScoreForId failed:', res.error);
    return null;
  }
  return parsePublicScoreRow(res.data ?? null);
}

/** Full cafe catalog — Supabase `public.cafes` is the source of truth for listing metadata. */
export async function fetchAllCafesFromSupabase(): Promise<Cafe[]> {
  const [res, pubMap] = await Promise.all([
    supabase.from('cafes').select('*'),
    fetchCafePublicScoresMap(),
  ]);
  const rawCount = res.data?.length ?? 0;

  debugCatalog('fetchAllCafesFromSupabase', {
    loading: false,
    error: res.error ? { message: res.error.message, code: res.error.code, details: res.error.details } : null,
    rowCount: rawCount,
    firstRowKeys: res.data?.[0] != null ? Object.keys(res.data[0] as object) : [],
    hint:
      !res.error && rawCount === 0
        ? 'Empty result with no error often means RLS has no SELECT policy for anon/authenticated, or the table has no rows.'
        : undefined,
  });

  if (res.error) {
    console.error('fetchAllCafesFromSupabase failed:', res.error);
    return [];
  }
  const out: Cafe[] = [];
  const rawRows = res.data ?? [];
  for (const r of rawRows) {
    const row = r as Record<string, unknown>;
    const base = mapCafeRowToCafe(row);
    if (!base) continue;
    out.push(mergePublicIntoCafe(base, resolvePublicScoreRowFromMap(base, row, pubMap)));
  }
  if (rawCount > 0 && out.length === 0) {
    debugCatalog('fetchAllCafesFromSupabase: rows dropped by mapper', {
      rawCount,
      mappedCount: out.length,
      hint: 'Check that each row has id or cafe_id set; mapper returns null only when both are missing.',
    });
  }

  debugCatalogFlow({
    step: 'fetchAllCafesFromSupabase',
    supabaseError: res.error,
    rawRowCount: res.data?.length ?? 0,
    firstRawRow: res.data?.[0] ?? null,
    mappedCafeCount: out.length,
    firstMappedCafe: out[0] ? { id: out[0].id, name: out[0].name } : null,
    diagnosis:
      rawCount > 0 && out.length === 0
        ? 'MAPPING_FAIL: rows returned but no Cafe after mapCafeRowToCafe'
        : rawCount === 0 && !res.error
          ? 'EMPTY_QUERY: 0 rows (often RLS or empty table from client)'
          : null,
  });

  return out;
}

export async function fetchCafeByIdFromSupabase(id: string): Promise<Cafe | null> {
  const res = await supabase.from('cafes').select('*').eq('id', id).maybeSingle();

  debugCatalog('fetchCafeByIdFromSupabase (eq id)', {
    id,
    error: res.error ? { message: res.error.message, code: res.error.code } : null,
    hasData: res.data != null,
  });

  if (res.error) {
    console.error('fetchCafeByIdFromSupabase failed:', res.error);
    return null;
  }
  if (res.data) {
    const raw = res.data as Record<string, unknown>;
    const base = mapCafeRowToCafe(raw);
    if (!base) return null;
    const pub = await fetchPublicScoreRowForCafeBase(base, raw);
    return mergePublicIntoCafe(base, pub);
  }

  // Safe fallback: some schemas use cafe_id as the primary column name, not id.
  const resByCafeId = await supabase.from('cafes').select('*').eq('cafe_id', id).maybeSingle();
  debugCatalog('fetchCafeByIdFromSupabase (eq cafe_id fallback)', {
    id,
    error: resByCafeId.error ? { message: resByCafeId.error.message, code: resByCafeId.error.code } : null,
    hasData: resByCafeId.data != null,
  });
  if (resByCafeId.error) {
    console.error('fetchCafeByIdFromSupabase cafe_id fallback failed:', resByCafeId.error);
    return null;
  }
  if (!resByCafeId.data) return null;
  const raw2 = resByCafeId.data as Record<string, unknown>;
  const base = mapCafeRowToCafe(raw2);
  if (!base) return null;
  const pub = await fetchPublicScoreRowForCafeBase(base, raw2);
  return mergePublicIntoCafe(base, pub);
}

/** Preserves caller order (e.g. visited rank or saved order). */
export async function fetchCafesByIdsOrdered(ids: string[]): Promise<Cafe[]> {
  if (ids.length === 0) return [];
  const [res, pubMap] = await Promise.all([
    supabase.from('cafes').select('*').in('id', ids),
    fetchCafePublicScoresForIds(ids),
  ]);

  debugCatalog('fetchCafesByIdsOrdered (in id)', {
    requestedIds: ids.length,
    error: res.error ? { message: res.error.message, code: res.error.code } : null,
    matchedRows: res.data?.length ?? 0,
  });

  if (res.error) {
    console.error('fetchCafesByIdsOrdered failed:', res.error);
    return [];
  }

  let rows = res.data ?? [];

  // If nothing matched, try cafe_id column (same id strings as user_saved_cafes.cafe_id).
  if (rows.length === 0 && ids.length > 0) {
    const res2 = await supabase.from('cafes').select('*').in('cafe_id', ids);
    debugCatalog('fetchCafesByIdsOrdered (in cafe_id fallback)', {
      requestedIds: ids.length,
      error: res2.error ? { message: res2.error.message, code: res2.error.code } : null,
      matchedRows: res2.data?.length ?? 0,
    });
    if (res2.error) {
      console.error('fetchCafesByIdsOrdered cafe_id fallback failed:', res2.error);
      return [];
    }
    rows = res2.data ?? [];
  }

  if (rows.length > 0 && rows.length < ids.length) {
    debugCatalog('fetchCafesByIdsOrdered: partial match', {
      requestedIds: ids.length,
      matchedRows: rows.length,
      hint: 'Some cafe_id values in user tables may not exist in public.cafes, or id type (uuid vs text) may not match.',
    });
  }

  const byId = new Map<string, Cafe>();
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const base = mapCafeRowToCafe(row);
    if (!base) continue;
    byId.set(base.id, mergePublicIntoCafe(base, resolvePublicScoreRowFromMap(base, row, pubMap)));
  }
  return ids.map((id) => byId.get(id)).filter((c): c is Cafe => c != null);
}
