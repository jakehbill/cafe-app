import type { VenueTypeValue } from '@/lib/venueTypes';

/** Four-screen onboarding flow. */
export const ONBOARDING_TOTAL_STEPS = 4;

export type OnboardingStepId = 'welcome' | 'preferences' | 'location' | 'challenge';

export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  'welcome',
  'preferences',
  'location',
  'challenge',
];

export function onboardingStepIndex(step: OnboardingStepId): number {
  return ONBOARDING_STEP_ORDER.indexOf(step);
}

export type OnboardingWorkspaceTypeOption = {
  value: VenueTypeValue | 'bar_pub';
  emoji: string;
  label: string;
};

export const ONBOARDING_WORKSPACE_TYPE_OPTIONS: OnboardingWorkspaceTypeOption[] = [
  { value: 'cafe', emoji: '☕', label: 'Café' },
  { value: 'coworking', emoji: '🏢', label: 'Coworking' },
  { value: 'library', emoji: '📚', label: 'Library' },
  { value: 'hotel_lobby', emoji: '🏨', label: 'Hotel Lobby' },
  { value: 'restaurant', emoji: '🍽', label: 'Restaurant' },
  { value: 'bar_pub', emoji: '🍺', label: 'Bar / Pub' },
];

export type WorkStyleId =
  | 'deep_focus'
  | 'cafe_creative'
  | 'social_worker'
  | 'hybrid_professional';

export type WorkStyleOption = {
  id: WorkStyleId;
  title: string;
  subtitle: string;
};

export const ONBOARDING_WORK_STYLE_OPTIONS: WorkStyleOption[] = [
  {
    id: 'deep_focus',
    title: 'Deep Focus',
    subtitle: 'Quiet, minimal distractions.',
  },
  {
    id: 'cafe_creative',
    title: 'Café Creative',
    subtitle: 'Beautiful cafés and great coffee.',
  },
  {
    id: 'social_worker',
    title: 'Social Worker',
    subtitle: 'Buzzing spaces with people around.',
  },
  {
    id: 'hybrid_professional',
    title: 'Hybrid Professional',
    subtitle: 'Reliable Wi-Fi and great for meetings.',
  },
];

/** Stored in `profiles.workspace_frustration`. */
export const ONBOARDING_CHALLENGE_OPTIONS = [
  'Finding somewhere quiet',
  'Reliable Wi-Fi',
  'Enough plugs',
  'Good coffee',
  'Somewhere I can take calls',
  "Knowing how busy it'll be",
  'Finding places worth trying',
] as const;

export type LocationMode = 'based' | 'nomad';

/** Curated cities — only shown after the user types in the search field. */
export const ONBOARDING_CITIES = [
  'Amsterdam',
  'Athens',
  'Auckland',
  'Bangkok',
  'Barcelona',
  'Berlin',
  'Birmingham',
  'Bristol',
  'Bucharest',
  'Budapest',
  'Buenos Aires',
  'Cape Town',
  'Chicago',
  'Copenhagen',
  'Dubai',
  'Dublin',
  'Edinburgh',
  'Frankfurt',
  'Glasgow',
  'Hamburg',
  'Ho Chi Minh City',
  'Hong Kong',
  'Istanbul',
  'Jakarta',
  'Johannesburg',
  'Kyoto',
  'Lisbon',
  'London',
  'Los Angeles',
  'Madrid',
  'Manchester',
  'Melbourne',
  'Mexico City',
  'Miami',
  'Milan',
  'Montreal',
  'Mumbai',
  'Munich',
  'New York',
  'Oslo',
  'Paris',
  'Porto',
  'Prague',
  'Rome',
  'San Francisco',
  'São Paulo',
  'Seattle',
  'Seoul',
  'Shoreditch, London',
  'Singapore',
  'Stockholm',
  'Sydney',
  'Taipei',
  'Tel Aviv',
  'Tokyo',
  'Toronto',
  'Vancouver',
  'Vienna',
  'Warsaw',
  'Zürich',
] as const;

/** Returns matches only when `query` is non-empty. */
export function filterOnboardingCities(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ONBOARDING_CITIES.filter((city) => city.toLowerCase().includes(q));
}

export function toggleMultiValue(current: string[], value: string): string[] {
  if (current.includes(value)) {
    return current.filter((v) => v !== value);
  }
  return [...current, value];
}
