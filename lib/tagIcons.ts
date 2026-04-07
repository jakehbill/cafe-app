import Ionicons from '@expo/vector-icons/Ionicons';

export type IoniconName = keyof typeof Ionicons.glyphMap;

/** Tags that intentionally render as plain text (no icon), per product rules. */
const TAGS_PLAIN_TEXT_ONLY = new Set<string>(['busy', 'aesthetic', 'cosy']);

/**
 * Known rating-tag slugs (`lib/cafeTags` / DB) → Ionicons glyph.
 * Unlisted dynamic tags use heuristics + `FALLBACK_TAG_ICON`.
 */
const TAG_ICON_BY_SLUG: Partial<Record<string, IoniconName>> = {
  good_wifi: 'wifi-outline',
  has_outlets: 'flash-outline',
  great_pastries: 'restaurant-outline',
  good_food: 'restaurant-outline',
  specialty_coffee: 'cafe-outline',
  great_espresso: 'cafe-outline',
  great_filter: 'cafe-outline',
  good_for_working: 'briefcase-outline',
  good_for_calls: 'call-outline',
  quiet: 'volume-mute-outline',
  spacious: 'expand-outline',
  open_late: 'moon-outline',
  outdoor_seating: 'sunny-outline',
  pet_friendly: 'paw-outline',
};

export const FALLBACK_TAG_ICON: IoniconName = 'pricetag-outline';

/** Search screen filter chips (`app/(tabs)/search.tsx` RANK_CHIPS) — not DB tags. */
export function getSearchFilterIcon(chipId: string): IoniconName | null {
  const map: Record<string, IoniconName> = {
    work: 'briefcase-outline',
    coffee: 'cafe-outline',
    atmosphere: 'sparkles-outline',
    quiet: 'volume-mute-outline',
    quick: 'flash-outline',
    trending: 'trending-up',
  };
  return map[chipId] ?? null;
}

/**
 * Returns an Ionicons name for this tag, or `null` when the tag should be text-only.
 * Unknown non-vibe tags get `FALLBACK_TAG_ICON` unless a heuristic matches.
 */
export function getTagIconName(tag: string): IoniconName | null {
  const k = tag.trim().toLowerCase();
  if (!k) return null;
  if (TAGS_PLAIN_TEXT_ONLY.has(k)) return null;
  // Product: "quick stop" should not use the lightning icon.
  if (k === 'quick_stop') return null;

  const direct = TAG_ICON_BY_SLUG[k];
  if (direct) return direct;

  if (k.includes('wifi')) return 'wifi-outline';
  if (k.includes('outlet') || k.includes('power') || k === 'power') return 'flash-outline';
  if (
    k.includes('pastry') ||
    k.includes('pastries') ||
    k.includes('food') ||
    k.includes('brunch')
  ) {
    return 'restaurant-outline';
  }
  if (
    k.includes('espresso') ||
    k.includes('filter') ||
    k.includes('specialty') ||
    k.includes('coffee') ||
    k === 'coffee'
  ) {
    return 'cafe-outline';
  }
  if (k.includes('work') || k.includes('laptop')) return 'briefcase-outline';
  if (k.includes('quiet')) return 'volume-mute-outline';
  if (k.includes('quick') || k.includes('fast')) return 'flash-outline';

  if (k.includes('busy') || k.includes('aesthetic') || k.includes('cosy') || k.includes('cozy')) {
    return null;
  }

  return FALLBACK_TAG_ICON;
}
