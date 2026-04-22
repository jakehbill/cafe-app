import { getCafePhotoUrls, type Cafe } from '@/data/cafes';

function clean(url: string | undefined | null): string {
  return String(url ?? '').trim();
}

function dedupeValid(urls: Array<string | undefined | null>): string[] {
  return Array.from(new Set(urls.map(clean).filter((url) => url.length > 0)));
}

export function resolveLiveCafeImageUrls(params: {
  cafe: Cafe;
  approvedPhotoUrls?: string[];
}): string[] {
  const approved = dedupeValid(params.approvedPhotoUrls ?? []);
  if (approved.length > 0) {
    return approved;
  }
  return dedupeValid(getCafePhotoUrls(params.cafe));
}

export function resolveLiveCafePrimaryImageUrl(params: {
  cafe: Cafe;
  approvedPhotoUrls?: string[];
}): string | undefined {
  const urls = resolveLiveCafeImageUrls(params);
  return urls[0];
}
