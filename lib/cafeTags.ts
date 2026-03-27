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
    title: 'Other / Vibe',
    tags: [
      'busy',
      'aesthetic',
      'cosy',
      'quick_stop',
      'brunch_spot',
      'pet_friendly',
    ],
  },
] as const;

export const ALL_RATING_TAGS = TAG_SECTIONS.flatMap((section) => section.tags);

export type RatingTag = (typeof ALL_RATING_TAGS)[number];

const LABEL_OVERRIDES: Record<string, string> = {
  good_for_working: 'Good for working',
  good_wifi: 'Good Wi-Fi',
  has_outlets: 'Has outlets',
  open_late: 'Open late',
  great_espresso: 'Great espresso',
  great_filter: 'Great filter',
  specialty_coffee: 'Specialty coffee',
  great_pastries: 'Great pastries',
  good_food: 'Good food',
  pet_friendly: 'Pet-friendly',
};

export function formatTagLabel(tag: string): string {
  if (!tag) return '';
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return '';
  if (LABEL_OVERRIDES[normalized]) return LABEL_OVERRIDES[normalized];
  return normalized
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}
