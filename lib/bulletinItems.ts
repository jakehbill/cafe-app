import { supabase, type SupabaseActionResult } from '@/lib/supabase';

export type BulletinItemStatus =
  | 'visible'
  | 'pending'
  | 'approved'
  | 'published'
  | 'hidden'
  | 'rejected'
  | 'spam';

/** Public Bulletin — shown unless explicitly removed. */
export const BULLETIN_VISIBLE_STATUSES: BulletinItemStatus[] = [
  'visible',
  'pending',
  'approved',
  'published',
];

export const BULLETIN_HIDDEN_STATUSES: BulletinItemStatus[] = ['hidden', 'rejected', 'spam'];

export type BulletinFeedItem = {
  id: string;
  cafeId: string | null;
  cafeSlug: string | null;
  cafeName: string;
  cafeArea: string | null;
  note: string;
  createdAt: string;
};

export type ModerationBulletinItem = {
  id: string;
  bulletin_id: string | null;
  user_id: string | null;
  created_at: string;
  source_visit_id: string;
  cafe_id: string;
  cafe_name: string | null;
  cafe_area: string | null;
  original_text: string;
  display_text: string;
  bulletin_text: string;
  status: BulletinItemStatus | 'visible';
};

function trimNote(note: unknown): string {
  return String(note ?? '').trim();
}

export function resolveBulletinDisplayNote(
  displayText: string | null | undefined,
  originalText: string | null | undefined
): string {
  return trimNote(displayText) || trimNote(originalText);
}

export function isBulletinStatusPublic(status: unknown): boolean {
  const s = String(status ?? '').trim();
  if (!s) return true;
  return BULLETIN_VISIBLE_STATUSES.includes(s as BulletinItemStatus);
}

function isHiddenBulletinStatus(status: unknown): boolean {
  return BULLETIN_HIDDEN_STATUSES.includes(String(status ?? '').trim() as BulletinItemStatus);
}

type BulletinFeedRpcRow = {
  row_key: string;
  bulletin_id: string | null;
  source_visit_id: string;
  cafe_id: string | null;
  cafe_name: string | null;
  cafe_area: string | null;
  note: string | null;
  created_at: string;
  item_status: string | null;
};

type BulletinModerationRpcRow = BulletinFeedRpcRow & {
  original_text: string | null;
  display_text: string | null;
  bulletin_text: string | null;
  user_id: string | null;
};

function mapFeedRow(row: BulletinFeedRpcRow): BulletinFeedItem | null {
  const note = trimNote(row.note);
  const createdAt = String(row.created_at ?? '').trim();
  if (!note || !createdAt) return null;
  if (!isBulletinStatusPublic(row.item_status)) return null;

  const cafeId = String(row.cafe_id ?? '').trim();
  return {
    id: String(row.bulletin_id ?? row.source_visit_id ?? row.row_key),
    cafeId: cafeId || null,
    cafeSlug: cafeId || null,
    cafeName: String(row.cafe_name ?? '').trim() || 'Cafe',
    cafeArea: String(row.cafe_area ?? '').trim() || null,
    note,
    createdAt,
  };
}

function mapModerationRow(row: BulletinModerationRpcRow): ModerationBulletinItem | null {
  const source_visit_id = String(row.source_visit_id ?? '').trim();
  if (!source_visit_id) return null;

  const original_text = trimNote(row.original_text);
  const display_text = trimNote(row.display_text);
  const bulletin_text = resolveBulletinDisplayNote(row.bulletin_text ?? display_text, original_text);
  if (!bulletin_text) return null;

  const statusRaw = String(row.item_status ?? 'visible').trim() || 'visible';
  const status = (
    isHiddenBulletinStatus(statusRaw) ? statusRaw : isBulletinStatusPublic(statusRaw) ? statusRaw : 'visible'
  ) as ModerationBulletinItem['status'];

  return {
    id: String(row.bulletin_id ?? `visit-${source_visit_id}`),
    bulletin_id: row.bulletin_id ? String(row.bulletin_id) : null,
    user_id: row.user_id ? String(row.user_id) : null,
    created_at: String(row.created_at ?? ''),
    source_visit_id,
    cafe_id: String(row.cafe_id ?? ''),
    cafe_name: row.cafe_name?.trim() || null,
    cafe_area: row.cafe_area?.trim() || null,
    original_text: original_text || bulletin_text,
    display_text: display_text || bulletin_text,
    bulletin_text,
    status,
  };
}

/** Client fallback when RPC is not deployed yet — no cafes embed. */
async function fetchVisibleBulletinItemsDirect(limit: number): Promise<BulletinFeedItem[]> {
  const res = await supabase
    .from('bulletin_items')
    .select('id, display_text, original_text, created_at, cafe_id, source_visit_id, status')
    .in('status', BULLETIN_VISIBLE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (res.error) {
    console.error('[fetchVisibleBulletinItemsDirect] select failed:', res.error.message);
    return [];
  }

  const cafeIds = Array.from(
    new Set(
      (res.data ?? [])
        .map((row) => String((row as { cafe_id?: unknown }).cafe_id ?? '').trim())
        .filter(Boolean)
    )
  );

  const cafeById = new Map<string, { name: string; area: string | null }>();
  if (cafeIds.length > 0) {
    const cafeRes = await supabase.from('cafes').select('id, name, area').in('id', cafeIds);
    if (!cafeRes.error) {
      for (const cafe of cafeRes.data ?? []) {
        const id = String((cafe as { id?: unknown }).id ?? '').trim();
        if (!id) continue;
        cafeById.set(id, {
          name: String((cafe as { name?: unknown }).name ?? '').trim() || 'Cafe',
          area: String((cafe as { area?: unknown }).area ?? '').trim() || null,
        });
      }
    }
  }

  return (res.data ?? [])
    .map((row) => {
      const typed = row as {
        id: string;
        display_text: string | null;
        original_text: string | null;
        created_at: string;
        cafe_id: string | null;
        source_visit_id: string | null;
        status: string | null;
      };
      if (!isBulletinStatusPublic(typed.status)) return null;
      const note = resolveBulletinDisplayNote(typed.display_text, typed.original_text);
      const createdAt = String(typed.created_at ?? '').trim();
      if (!note || !createdAt) return null;
      const cafeId = String(typed.cafe_id ?? '').trim();
      const cafe = cafeById.get(cafeId);
      return {
        id: String(typed.id),
        cafeId: cafeId || null,
        cafeSlug: cafeId || null,
        cafeName: cafe?.name ?? 'Cafe',
        cafeArea: cafe?.area ?? null,
        note,
        createdAt,
      } satisfies BulletinFeedItem;
    })
    .filter((row): row is BulletinFeedItem => row != null);
}

/**
 * When a visit gets a non-empty note, upsert a visible Bulletin row (live by default).
 */
export async function syncBulletinItemFromVisit(params: {
  visitId: string;
  cafeId: string | null;
  userId: string;
  note: string;
}): Promise<void> {
  const visitId = String(params.visitId ?? '').trim();
  const cafeId = String(params.cafeId ?? '').trim();
  const userId = String(params.userId ?? '').trim();
  const note = trimNote(params.note);

  if (!visitId || !userId) return;

  if (!note || !cafeId) {
    await supabase
      .from('bulletin_items')
      .delete()
      .eq('source_visit_id', visitId)
      .eq('user_id', userId)
      .in('status', BULLETIN_VISIBLE_STATUSES);
    return;
  }

  const existingRes = await supabase
    .from('bulletin_items')
    .select('id, status, display_text, original_text')
    .eq('source_visit_id', visitId)
    .maybeSingle();

  if (existingRes.error) {
    console.warn('[syncBulletinItemFromVisit] select failed:', existingRes.error.message);
    return;
  }

  const now = new Date().toISOString();
  const existing = existingRes.data as {
    id: string;
    status: BulletinItemStatus;
    display_text: string | null;
    original_text: string | null;
  } | null;

  if (existing) {
    const isHidden = isHiddenBulletinStatus(existing.status);
    const priorOriginal = trimNote(existing.original_text);
    const priorDisplay = trimNote(existing.display_text);
    const wasCurated = priorDisplay.length > 0 && priorDisplay !== priorOriginal;
    const nextDisplay = isHidden
      ? wasCurated
        ? priorDisplay
        : note
      : wasCurated
        ? priorDisplay
        : note;

    const updateRes = await supabase
      .from('bulletin_items')
      .update({
        cafe_id: cafeId,
        original_text: note,
        display_text: nextDisplay,
        status: isHidden ? existing.status : 'visible',
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('user_id', userId);

    if (updateRes.error) {
      console.warn('[syncBulletinItemFromVisit] update failed:', updateRes.error.message);
    }
    return;
  }

  const insertRes = await supabase.from('bulletin_items').insert({
    source_visit_id: visitId,
    cafe_id: cafeId,
    user_id: userId,
    original_text: note,
    display_text: note,
    status: 'visible',
  });

  if (insertRes.error) {
    console.warn('[syncBulletinItemFromVisit] insert failed:', insertRes.error.message);
  }
}

export async function removeBulletinItemForVisit(visitId: string): Promise<void> {
  const key = String(visitId ?? '').trim();
  if (!key) return;
  await supabase
    .from('bulletin_items')
    .delete()
    .eq('source_visit_id', key)
    .in('status', BULLETIN_VISIBLE_STATUSES);
}

/** Home Beaned Bulletin — visits with notes, minus hidden/rejected/spam. */
export async function getRecentVisibleBulletinItems(limit = 5): Promise<BulletinFeedItem[]> {
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));

  const rpcRes = await supabase.rpc('get_recent_bulletin_feed', { p_limit: safeLimit });
  if (!rpcRes.error) {
    return ((rpcRes.data ?? []) as BulletinFeedRpcRow[])
      .map(mapFeedRow)
      .filter((row): row is BulletinFeedItem => row != null)
      .slice(0, safeLimit);
  }

  if (__DEV__) {
    console.warn(
      '[getRecentVisibleBulletinItems] RPC get_recent_bulletin_feed failed, using bulletin_items fallback:',
      rpcRes.error.message
    );
  }

  return fetchVisibleBulletinItemsDirect(safeLimit);
}

/** @deprecated Use getRecentVisibleBulletinItems */
export const getRecentApprovedBulletinItems = getRecentVisibleBulletinItems;

async function fetchModerationFeedFromRpc(): Promise<ModerationBulletinItem[] | null> {
  const res = await supabase.rpc('get_bulletin_moderation_feed');
  if (res.error) {
    if (__DEV__) {
      console.warn('[fetchModerationFeedFromRpc] failed:', res.error.message);
    }
    return null;
  }
  return ((res.data ?? []) as BulletinModerationRpcRow[])
    .map(mapModerationRow)
    .filter((row): row is ModerationBulletinItem => row != null);
}

export async function fetchVisibleBulletinItemsForModeration(): Promise<ModerationBulletinItem[]> {
  const rows = await fetchModerationFeedFromRpc();
  if (rows) {
    return rows.filter((row) => isBulletinStatusPublic(row.status));
  }

  const res = await supabase
    .from('bulletin_items')
    .select('id, created_at, source_visit_id, cafe_id, original_text, display_text, status')
    .in('status', BULLETIN_VISIBLE_STATUSES)
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error('[fetchVisibleBulletinItemsForModeration] select failed:', res.error.message);
    return [];
  }

  return (res.data ?? []).map((row) => {
    const typed = row as {
      id: string;
      created_at: string;
      source_visit_id: string;
      cafe_id: string;
      original_text: string;
      display_text: string;
      status: BulletinItemStatus;
    };
    const original_text = trimNote(typed.original_text);
    const display_text = trimNote(typed.display_text);
    return {
      id: typed.id,
      bulletin_id: typed.id,
      user_id: null,
      created_at: typed.created_at,
      source_visit_id: typed.source_visit_id,
      cafe_id: String(typed.cafe_id ?? ''),
      cafe_name: null,
      cafe_area: null,
      original_text,
      display_text,
      bulletin_text: resolveBulletinDisplayNote(display_text, original_text),
      status: typed.status,
    } satisfies ModerationBulletinItem;
  });
}

export async function fetchHiddenBulletinItemsForModeration(): Promise<ModerationBulletinItem[]> {
  const rows = await fetchModerationFeedFromRpc();
  if (rows) {
    return rows.filter((row) => isHiddenBulletinStatus(row.status));
  }

  const res = await supabase
    .from('bulletin_items')
    .select('id, created_at, source_visit_id, cafe_id, original_text, display_text, status')
    .in('status', BULLETIN_HIDDEN_STATUSES)
    .order('created_at', { ascending: false });

  if (res.error) {
    console.error('[fetchHiddenBulletinItemsForModeration] select failed:', res.error.message);
    return [];
  }

  return (res.data ?? []).map((row) => {
    const typed = row as {
      id: string;
      created_at: string;
      source_visit_id: string;
      cafe_id: string;
      original_text: string;
      display_text: string;
      status: BulletinItemStatus;
    };
    const original_text = trimNote(typed.original_text);
    const display_text = trimNote(typed.display_text);
    return {
      id: typed.id,
      bulletin_id: typed.id,
      user_id: null,
      created_at: typed.created_at,
      source_visit_id: typed.source_visit_id,
      cafe_id: String(typed.cafe_id ?? ''),
      cafe_name: null,
      cafe_area: null,
      original_text,
      display_text,
      bulletin_text: resolveBulletinDisplayNote(display_text, original_text),
      status: typed.status,
    } satisfies ModerationBulletinItem;
  });
}

async function resolveBulletinRowId(item: ModerationBulletinItem): Promise<string | null> {
  if (item.bulletin_id) return item.bulletin_id;

  const lookup = await supabase
    .from('bulletin_items')
    .select('id')
    .eq('source_visit_id', item.source_visit_id)
    .maybeSingle();
  if (!lookup.error && lookup.data?.id) {
    return String(lookup.data.id);
  }

  const cafeId = String(item.cafe_id ?? '').trim();
  const userId = String(item.user_id ?? '').trim();
  const original = trimNote(item.original_text);
  if (!cafeId || !userId || !original) return null;

  const insertRes = await supabase
    .from('bulletin_items')
    .insert({
      source_visit_id: item.source_visit_id,
      cafe_id: cafeId,
      user_id: userId,
      original_text: original,
      display_text: trimNote(item.display_text) || original,
      status: 'hidden',
    })
    .select('id')
    .single();

  if (insertRes.error || !insertRes.data?.id) {
    console.warn('[resolveBulletinRowId] insert failed:', insertRes.error?.message);
    return null;
  }
  return String(insertRes.data.id);
}

export async function hideBulletinItem(item: ModerationBulletinItem): Promise<SupabaseActionResult> {
  const bulletinId = await resolveBulletinRowId(item);
  if (!bulletinId) {
    return { ok: false, error: 'Could not resolve Bulletin row to hide.' };
  }

  const res = await supabase
    .from('bulletin_items')
    .update({ status: 'hidden', updated_at: new Date().toISOString() })
    .eq('id', bulletinId);

  if (res.error) {
    return { ok: false, error: res.error.message };
  }
  return { ok: true };
}

export async function restoreBulletinItem(item: ModerationBulletinItem): Promise<SupabaseActionResult> {
  const bulletinId = await resolveBulletinRowId(item);
  if (!bulletinId) {
    return { ok: false, error: 'Could not resolve Bulletin row to restore.' };
  }

  const res = await supabase
    .from('bulletin_items')
    .update({ status: 'visible', updated_at: new Date().toISOString() })
    .eq('id', bulletinId)
    .eq('status', 'hidden');

  if (res.error) {
    return { ok: false, error: res.error.message };
  }
  return { ok: true };
}
