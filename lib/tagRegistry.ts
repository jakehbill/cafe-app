import type { IoniconName } from '@/lib/tagIcons';

export type TagCategory = 'Coffee' | 'Work' | 'Vibe' | 'Other';

export type CanonicalTagSlug =
  | 'great_espresso'
  | 'great_filter'
  | 'specialty_coffee'
  | 'cold_brew'
  | 'single_origin'
  | 'good_decaf'
  | 'matcha'
  | 'good_iced_drinks'
  | 'great_pastries'
  | 'good_food'
  | 'vegan_friendly'
  | 'good_for_working'
  | 'good_wifi'
  | 'has_outlets'
  | 'quiet'
  | 'spacious'
  | 'open_late'
  | 'good_for_calls'
  | 'busy'
  | 'aesthetic'
  | 'cosy'
  | 'good_natural_light'
  | 'neighborhood_feel'
  | 'outdoor_seating'
  | 'quick_stop'
  | 'pet_friendly'
  | 'comfortable_seating'
  | 'long_stays_welcome'
  | 'good_coffee'
  | 'air_conditioning'
  | 'friendly_staff';

export type CanonicalTagDef = {
  category: TagCategory;
  /** Canonical stored value (slug) used for filtering & persistence. */
  slug: CanonicalTagSlug;
  /** Single source of truth for UI label. */
  displayLabel: string;
  /** Optional Ionicons glyph name; null = intentionally text-only. */
  icon: IoniconName | null;
  /**
   * Legacy/alias values that should resolve to this tag.
   * These are compared after normalization (spaces/underscores/hyphens).
   */
  aliases: string[];
};

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title Case for display; hyphenated segments are capitalized on both sides. */
export function toTagDisplayTitleCase(raw: string): string {
  const trimmed = raw.trim().replace(/_/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/g)
    .filter(Boolean)
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          const p = part.trim();
          if (!p) return p;
          if (p.toLowerCase() === 'wifi') return 'WiFi';
          return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
        })
        .join('-')
    )
    .join(' ');
}

/** Canonical tag registry (single source of truth). */
export const TAG_REGISTRY: Record<CanonicalTagSlug, CanonicalTagDef> = {
  great_espresso: {
    category: 'Coffee',
    slug: 'great_espresso',
    displayLabel: 'Great Espresso',
    icon: 'cafe-outline',
    aliases: [
      'great espresso',
      'excellent espresso',
      'espresso',
      'flat white',
      'best for flat white',
      'coffee quality',
      'great_espresso',
    ],
  },
  great_filter: {
    category: 'Coffee',
    slug: 'great_filter',
    displayLabel: 'Great Filter',
    icon: 'cafe-outline',
    aliases: [
      'great filter',
      'great filter coffee',
      'filter coffee',
      'filter',
      'pour over',
      'pour-over',
      'v60',
      'chemex',
      'great_filter',
    ],
  },
  specialty_coffee: {
    category: 'Coffee',
    slug: 'specialty_coffee',
    displayLabel: 'Specialty Beans',
    icon: 'cafe-outline',
    aliases: ['specialty coffee', 'specialty beans', 'specialty_coffee'],
  },
  cold_brew: {
    category: 'Coffee',
    slug: 'cold_brew',
    displayLabel: 'Cold Brew',
    icon: 'cafe-outline',
    aliases: ['cold brew', 'cold-brew', 'iced coffee', 'cold brew coffee', 'cold_brew'],
  },
  single_origin: {
    category: 'Coffee',
    slug: 'single_origin',
    displayLabel: 'Single Origin',
    icon: 'cafe-outline',
    aliases: ['single origin', 'single-origin', 'single origin coffee', 'single_origin'],
  },
  good_decaf: {
    category: 'Coffee',
    slug: 'good_decaf',
    displayLabel: 'Good Decaf',
    icon: 'cafe-outline',
    aliases: ['good decaf', 'decaf', 'decaffeinated', 'decaf coffee', 'good_decaf'],
  },
  matcha: {
    category: 'Coffee',
    slug: 'matcha',
    displayLabel: 'Matcha',
    icon: 'cafe-outline',
    aliases: ['matcha', 'matcha latte', 'matcha lattes'],
  },
  good_iced_drinks: {
    category: 'Coffee',
    slug: 'good_iced_drinks',
    displayLabel: 'Good Iced Drinks',
    icon: 'cafe-outline',
    aliases: ['good iced drinks', 'iced drinks', 'iced drink', 'good_iced_drinks'],
  },
  great_pastries: {
    category: 'Coffee',
    slug: 'great_pastries',
    displayLabel: 'Great Pastries',
    icon: 'restaurant-outline',
    aliases: ['great pastries', 'pastries', 'pastry', 'croissant', 'great_pastries'],
  },
  good_food: {
    category: 'Coffee',
    slug: 'good_food',
    displayLabel: 'Good Food',
    icon: 'restaurant-outline',
    aliases: ['good food', 'food', 'brunch', 'lunch', 'good_food'],
  },
  vegan_friendly: {
    category: 'Coffee',
    slug: 'vegan_friendly',
    displayLabel: 'Vegan-Friendly',
    icon: 'restaurant-outline',
    aliases: [
      'vegan friendly',
      'vegan-friendly',
      'vegan',
      'plant based',
      'plant-based',
      'vegan_friendly',
    ],
  },

  good_for_working: {
    category: 'Work',
    slug: 'good_for_working',
    displayLabel: 'Work-Friendly',
    icon: 'briefcase-outline',
    aliases: [
      'work friendly',
      'work-friendly',
      'good for working',
      'good for work',
      'laptop friendly',
      'laptop',
      'working',
      'good_for_working',
    ],
  },
  good_wifi: {
    category: 'Work',
    slug: 'good_wifi',
    displayLabel: 'Fast WiFi',
    icon: 'wifi-outline',
    aliases: ['fast wifi', 'good wifi', 'wifi', 'wi fi', 'wi-fi', 'wireless', 'internet', 'good_wifi'],
  },
  has_outlets: {
    category: 'Work',
    slug: 'has_outlets',
    displayLabel: 'Lots Of Outlets',
    icon: 'flash-outline',
    aliases: [
      'has outlets',
      'lots of outlets',
      'outlets',
      'power outlets',
      'power',
      'has_outlets',
    ],
  },
  quiet: {
    category: 'Work',
    slug: 'quiet',
    displayLabel: 'Quiet',
    icon: 'volume-mute-outline',
    aliases: ['quiet', 'calm', 'peaceful', 'relaxed', 'quiet spot'],
  },
  spacious: {
    category: 'Work',
    slug: 'spacious',
    displayLabel: 'Spacious Tables',
    icon: 'expand-outline',
    aliases: ['spacious', 'space', 'roomy', 'spacious tables', 'big tables'],
  },
  open_late: {
    category: 'Work',
    slug: 'open_late',
    displayLabel: 'Open Late',
    icon: 'moon-outline',
    aliases: ['open late', 'late', 'open_late'],
  },
  good_for_calls: {
    category: 'Work',
    slug: 'good_for_calls',
    displayLabel: 'Great For Calls',
    icon: 'call-outline',
    aliases: [
      'good for calls',
      'great for calls',
      'good for meetings',
      'calls',
      'call friendly',
      'meetings',
      'good_for_calls',
    ],
  },
  comfortable_seating: {
    category: 'Work',
    slug: 'comfortable_seating',
    displayLabel: 'Comfortable Seating',
    icon: null,
    aliases: ['comfortable seating', 'comfy seats', 'comfortable seats', 'comfortable_seating'],
  },
  long_stays_welcome: {
    category: 'Work',
    slug: 'long_stays_welcome',
    displayLabel: 'Long Stays Welcome',
    icon: null,
    aliases: [
      'long stays welcome',
      'long stay',
      'laptop friendly',
      'laptop-friendly',
      'long_stays_welcome',
    ],
  },
  good_coffee: {
    category: 'Coffee',
    slug: 'good_coffee',
    displayLabel: 'Good Coffee',
    icon: 'cafe-outline',
    aliases: ['good coffee', 'nice coffee', 'good_coffee'],
  },
  air_conditioning: {
    category: 'Work',
    slug: 'air_conditioning',
    displayLabel: 'Air Conditioning',
    icon: null,
    aliases: ['air conditioning', 'ac', 'a/c', 'air con', 'air_conditioning'],
  },
  friendly_staff: {
    category: 'Vibe',
    slug: 'friendly_staff',
    displayLabel: 'Friendly Staff',
    icon: null,
    aliases: ['friendly staff', 'nice staff', 'friendly_staff'],
  },

  busy: {
    category: 'Vibe',
    slug: 'busy',
    displayLabel: 'Busy',
    icon: null,
    aliases: ['busy', 'buzzy'],
  },
  aesthetic: {
    category: 'Vibe',
    slug: 'aesthetic',
    displayLabel: 'Aesthetic',
    icon: null,
    aliases: [
      'aesthetic',
      'design-led',
      'design led',
      'minimal',
      'clean',
      'pretty',
      'design',
      'trendy',
      'instagrammable',
    ],
  },
  cosy: {
    category: 'Vibe',
    slug: 'cosy',
    displayLabel: 'Cosy',
    icon: null,
    aliases: ['cosy', 'cozy', 'warm'],
  },
  good_natural_light: {
    category: 'Vibe',
    slug: 'good_natural_light',
    displayLabel: 'Good Natural Light',
    icon: null,
    aliases: [
      'good natural light',
      'natural light',
      'sunlight',
      'bright',
      'bright light',
      'sunny',
      'well lit',
      'well-lit',
      'good_natural_light',
    ],
  },
  neighborhood_feel: {
    category: 'Vibe',
    slug: 'neighborhood_feel',
    displayLabel: 'Neighborhood Feel',
    icon: null,
    aliases: [
      'neighborhood feel',
      'neighbourhood feel',
      'neighborhood',
      'neighbourhood',
      'local',
      'local feel',
      'community feel',
      'community',
      'neighborhood_feel',
    ],
  },

  outdoor_seating: {
    category: 'Other',
    slug: 'outdoor_seating',
    displayLabel: 'Outdoor Seating',
    icon: 'sunny-outline',
    aliases: ['outdoor seating', 'outside seating', 'patio', 'terrace', 'outdoor', 'outdoor_seating'],
  },
  quick_stop: {
    category: 'Other',
    slug: 'quick_stop',
    displayLabel: 'Fast Service',
    icon: null,
    aliases: [
      'fast service',
      'quick stop',
      'better for short stop',
      'short stop',
      'quick',
      'fast',
      'quick_stop',
    ],
  },
  pet_friendly: {
    category: 'Other',
    slug: 'pet_friendly',
    displayLabel: 'Pet-Friendly',
    icon: 'paw-outline',
    aliases: ['pet friendly', 'pet-friendly', 'dog friendly', 'dog', 'pet_friendly'],
  },
};

export const CANONICAL_TAG_SLUGS = Object.keys(TAG_REGISTRY) as CanonicalTagSlug[];
export const CANONICAL_TAG_SLUG_SET = new Set<string>(CANONICAL_TAG_SLUGS);

/** Resolve any raw tag string (slug/label/legacy) to a canonical slug. */
export function resolveToCanonicalTagSlug(raw: string): CanonicalTagSlug | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (CANONICAL_TAG_SLUG_SET.has(lower)) return lower as CanonicalTagSlug;

  const key = normalizeKey(t);
  for (const def of Object.values(TAG_REGISTRY)) {
    if (normalizeKey(def.displayLabel) === key) return def.slug;
    for (const a of def.aliases) {
      if (normalizeKey(a) === key) return def.slug;
    }
    // slug-as-words also counts
    if (normalizeKey(def.slug.replace(/_/g, ' ')) === key) return def.slug;
  }

  return null;
}

export function getTagDisplayLabel(slugOrRaw: string): string {
  const slug = resolveToCanonicalTagSlug(slugOrRaw);
  if (slug) return TAG_REGISTRY[slug].displayLabel;
  return toTagDisplayTitleCase(slugOrRaw);
}

export function getTagIcon(slugOrRaw: string): IoniconName | null {
  const slug = resolveToCanonicalTagSlug(slugOrRaw);
  if (!slug) return null;
  return TAG_REGISTRY[slug].icon;
}

/** UI section label for a tag category (internal `TagCategory` keys unchanged). */
export function getTagCategoryDisplayLabel(category: TagCategory): string {
  if (category === 'Coffee') return 'Coffee / Food';
  return category;
}

export function getTagSections(): { title: string; tags: CanonicalTagSlug[] }[] {
  const byCategory: Record<TagCategory, CanonicalTagSlug[]> = {
    Coffee: [],
    Work: [],
    Vibe: [],
    Other: [],
  };
  for (const slug of CANONICAL_TAG_SLUGS) {
    byCategory[TAG_REGISTRY[slug].category].push(slug);
  }
  // Preserve the intended ordering as per registry listing above.
  const order: TagCategory[] = ['Coffee', 'Work', 'Vibe', 'Other'];
  return order.map((category) => ({
    title: getTagCategoryDisplayLabel(category),
    tags: byCategory[category],
  }));
}

/** Returns canonical slugs represented in a cafe tag array (mixed values). */
export function getCanonicalSlugsFromCafeTags(cafeTags: string[] | undefined): Set<CanonicalTagSlug> {
  const out = new Set<CanonicalTagSlug>();
  for (const raw of cafeTags ?? []) {
    const slug = resolveToCanonicalTagSlug(raw);
    if (slug) out.add(slug);
  }
  return out;
}

export function cafeHasAllCanonicalSlugs(cafe: { tags?: string[] }, required: string[]): boolean {
  if (required.length === 0) return true;
  const present = getCanonicalSlugsFromCafeTags(cafe.tags);
  return required.every((s) => present.has((s.trim().toLowerCase() as CanonicalTagSlug) ?? ''));
}

/** Returns all possible DB values that should count for a canonical tag (slug + aliases). */
export function getAllDbValuesForCanonicalTag(slug: CanonicalTagSlug): string[] {
  const def = TAG_REGISTRY[slug];
  const list = [def.slug, def.displayLabel, ...def.aliases, def.slug.replace(/_/g, ' ')];
  const uniq = new Set<string>();
  for (const v of list) {
    const t = v.trim();
    if (t) uniq.add(t);
    const lower = t.toLowerCase();
    if (lower) uniq.add(lower);
  }
  return Array.from(uniq);
}

