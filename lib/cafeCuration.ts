/**
 * Beaned curation model for `public.cafes`:
 * - status: pending | active | archived
 * - is_certified: editorial “Beaned Pick”
 */

export type CafeStatus = 'pending' | 'active' | 'archived';

const STATUS_SET = new Set<CafeStatus>(['pending', 'active', 'archived']);

/**
 * Normalize DB status. Missing/unknown → `active` so legacy live rows stay discoverable
 * until backfilled; archived/pending are explicit.
 */
export function normalizeCafeStatus(raw: unknown): CafeStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (STATUS_SET.has(s as CafeStatus)) return s as CafeStatus;
  return 'active';
}

export function normalizeIsCertified(raw: unknown): boolean {
  if (raw === true || raw === 1 || raw === '1') return true;
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'true') return true;
  return false;
}

export function isCafeActive(status: CafeStatus | string | null | undefined): boolean {
  return normalizeCafeStatus(status) === 'active';
}

/** Homepage curated feed: active + certified only. */
export function isCafeHomeEligible(cafe: {
  status: CafeStatus;
  isCertified: boolean;
}): boolean {
  return cafe.status === 'active' && cafe.isCertified === true;
}

/** Search / maps / public discovery: any active space (certified optional). */
export function isCafeSearchEligible(cafe: { status: CafeStatus }): boolean {
  return cafe.status === 'active';
}

/** Anywhere public (landing, detail): never show non-active. */
export function isCafePubliclyVisible(cafe: { status: CafeStatus }): boolean {
  return cafe.status === 'active';
}
