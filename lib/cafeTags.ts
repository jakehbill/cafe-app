export const TAG_SECTIONS = [
  {
    title: 'Coffee',
    tags: [
      'great_espresso',
      'great_filter',
      'specialty_coffee',
      'great_pastries',
      'good_food',
    ],
  },
  {
    title: 'Work',
    tags: [
      'good_for_working',
      'good_wifi',
      'has_outlets',
      'quiet',
      'spacious',
      'open_late',
    ],
  },
  {
    title: 'Vibe',
    tags: [
      'busy',
      'aesthetic',
      'cosy',
    ],
  },
  {
    title: 'Other',
    tags: ['outdoor_seating', 'quick_stop', 'pet_friendly'],
  },
] as const;

export const ALL_RATING_TAGS = TAG_SECTIONS.flatMap((section) => section.tags);

export type RatingTag = (typeof ALL_RATING_TAGS)[number];

const LABEL_OVERRIDES: Record<string, string> = {
  // Keep special casing for acronyms / punctuation.
  good_wifi: 'Good Wifi',
  specialty_coffee: 'Specialty Beans',
  quick_stop: 'Fast Service',
};

export function formatTagLabel(tag: string): string {
  if (!tag) return '';
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return '';
  if (LABEL_OVERRIDES[normalized]) return LABEL_OVERRIDES[normalized];

  // Convert slugs and free-text tags into title case for UI while keeping storage lowercase.
  // Examples:
  // - "outdoor seating" -> "Outdoor Seating"
  // - "good_for_working" -> "Good For Working"
  // - "pet-friendly" -> "Pet-Friendly"
  const words = normalized.replace(/_/g, ' ').split(/\s+/g).filter(Boolean);
  const titleWords = words.map((w) =>
    w
      .split('-')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join('-')
  );
  return titleWords.join(' ');
}
