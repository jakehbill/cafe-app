import type { Cafe } from '@/data/cafes';
import { resolveCafeMapsUrl } from '@/lib/cafeMapsUrl';
import { rawPublicCoffeeToOutOf5 } from '@/lib/publicCoffeeDisplay';

/**
 * Polished share line for native share sheet:
 * "Check out {name}{ in area} on Beaned{ — rated X.Y. | .}{ maps URL if any}"
 */
export function buildCafeShareMessage(cafe: Cafe): string {
  const name = (cafe.name ?? '').trim() || 'This cafe';
  const neighborhood = (cafe.neighborhood ?? '').trim();
  const areaIn = neighborhood.length > 0 ? ` in ${neighborhood}` : '';

  const scoreN = rawPublicCoffeeToOutOf5(cafe.publicCoffeeScore);
  const afterBeaned = scoreN != null ? ` — rated ${scoreN.toFixed(1)}.` : '.';

  let msg = `Check out ${name}${areaIn} on Beaned${afterBeaned}`;

  const url = resolveCafeMapsUrl(cafe);
  if (url) {
    msg += ` ${url}`;
  }

  return msg;
}
