import { getCafePhotoUrls, type Cafe } from '@/data/cafes';

export const CAFE_PLACEHOLDER_IMAGE_URL =
  'https://fhmtmibghmjuurzyncyh.supabase.co/storage/v1/object/public/cafe-images/Beaned%20Image%20Placeholder.png';

function normalizeImageUrl(url: unknown): string {
  return String(url ?? '').trim();
}

function isValidCafeImageUrl(url: unknown): url is string {
  const s = normalizeImageUrl(url);
  if (s.length === 0) return false;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return false;

  // Treat "broken-looking storage paths" (e.g. relative storage paths) as invalid.
  // Our UI expects fully-qualified HTTP(S) image URLs.
  if (!/^https?:\/\//i.test(s)) return false;
  return true;
}

function dedupeValidImageUrls(urls: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const normalized = normalizeImageUrl(raw);
    if (!normalized) continue;
    if (!isValidCafeImageUrl(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function resolveLiveCafeImageUrls(params: {
  cafe: Cafe;
  approvedPhotoUrls?: string[];
}): string[] {
  // Priority:
  // 1. approved cafe_photos (caller-provided)
  // 2. first valid cafes.image_urls item(s) / legacy photo columns
  // 3. branded app fallback placeholder
  const approved = dedupeValidImageUrls(params.approvedPhotoUrls ?? []);
  if (approved.length > 0) return approved;

  const fromCafeRow = dedupeValidImageUrls(getCafePhotoUrls(params.cafe));
  if (fromCafeRow.length > 0) return fromCafeRow;

  return [CAFE_PLACEHOLDER_IMAGE_URL];
}

export function resolveLiveCafePrimaryImageUrl(params: {
  cafe: Cafe;
  approvedPhotoUrls?: string[];
  /**
   * Optional override (e.g. visit photos).
   * Only used when it is a valid HTTP(S) image URL.
   */
  overrideImageUrl?: string | null;
}): string {
  const override = normalizeImageUrl(params.overrideImageUrl);
  if (override && isValidCafeImageUrl(override)) return override;

  const urls = resolveLiveCafeImageUrls({
    cafe: params.cafe,
    approvedPhotoUrls: params.approvedPhotoUrls,
  });
  return urls[0] ?? CAFE_PLACEHOLDER_IMAGE_URL;
}
