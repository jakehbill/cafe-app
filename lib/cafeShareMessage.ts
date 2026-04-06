import type { Cafe } from '@/data/cafes';
import { resolveCafeMapsUrl } from '@/lib/cafeMapsUrl';

/**
 * Share line for native share sheet (no ratings):
 * "Check out {name}{ in area} on Beaned. {maps URL if any}"
 */
export function buildCafeShareMessage(cafe: Cafe): string {
  const name = (cafe.name ?? '').trim() || 'This cafe';
  const neighborhood = (cafe.neighborhood ?? '').trim();
  const areaIn = neighborhood.length > 0 ? ` in ${neighborhood}` : '';

  let msg = `Check out ${name}${areaIn} on Beaned.`;

  const url = resolveCafeMapsUrl(cafe);
  if (url) {
    msg += ` ${url}`;
  }

  return msg;
}
