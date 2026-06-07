import type { CanonicalTagSlug } from '@/lib/tagRegistry';

export type PublicLandingStep = {
  title: string;
  body: string;
};

export type PublicLandingPageConfig = {
  slug: string;
  joinSource: string;
  heroTitle: string;
  heroSubtitle: string;
  explanation: string;
  tagSlugs?: readonly CanonicalTagSlug[];
  londonOnly?: boolean;
  tagLabels?: readonly string[];
  steps?: readonly PublicLandingStep[];
  fallbackBlurb: string;
  showBrowseLink?: boolean;
};

export const WORKING_FROM_CAFES_PAGE: PublicLandingPageConfig = {
  slug: 'working-from-cafes',
  joinSource: 'working-from-cafes',
  heroTitle: 'Find cafés you can actually work from.',
  heroSubtitle:
    'Beaned helps you discover cafés with the right mix of coffee, WiFi, atmosphere, and laptop-friendly energy.',
  explanation:
    'Curated picks with work-friendly signals from the Beaned community — WiFi, outlets, quiet corners, and space to settle in.',
  tagSlugs: [
    'good_for_working',
    'good_wifi',
    'has_outlets',
    'quiet',
    'good_for_calls',
    'spacious',
    'good_natural_light',
  ],
  tagLabels: [
    'Work-Friendly',
    'Fast WiFi',
    'Has Outlets',
    'Quiet',
    'Good For Calls',
    'Spacious',
    'Good Natural Light',
  ],
  fallbackBlurb:
    'Join the beta to unlock work-friendly café picks tailored to how you actually work — laptop hours, calls, and coffee quality in one place.',
  showBrowseLink: true,
};

export const BEST_COFFEE_LONDON_PAGE: PublicLandingPageConfig = {
  slug: 'best-coffee-london',
  joinSource: 'best-coffee-london',
  heroTitle: 'Better coffee, fewer guesses.',
  heroSubtitle:
    'Discover cafés worth visiting for espresso, filter coffee, single origin beans, cold brew, matcha, and more.',
  explanation:
    'London cafés rated for coffee quality — from specialty beans and flat whites to filter, matcha, and iced drinks.',
  tagSlugs: [
    'specialty_coffee',
    'great_espresso',
    'great_filter',
    'single_origin',
    'cold_brew',
    'matcha',
    'good_decaf',
    'good_iced_drinks',
  ],
  tagLabels: [
    'Specialty Beans',
    'Great Espresso',
    'Great Filter',
    'Single Origin',
    'Cold Brew',
    'Matcha',
    'Good Decaf',
    'Good Iced Drinks',
  ],
  londonOnly: true,
  fallbackBlurb:
    'Join the beta for coffee-first recommendations across London — fewer guesses, more cups worth the trip.',
  showBrowseLink: true,
};

export const HIDDEN_GEM_CAFES_PAGE: PublicLandingPageConfig = {
  slug: 'hidden-gem-cafes',
  joinSource: 'hidden-gem-cafes',
  heroTitle: 'Find the cafés you’d usually walk past.',
  heroSubtitle:
    'Hidden corners, neighbourhood favourites, and places worth saving for later.',
  explanation:
    'Neighbourhood-feel spots with cosy corners, design-led interiors, and relaxed energy — the kind you bookmark for later.',
  tagSlugs: ['neighborhood_feel', 'cosy', 'aesthetic', 'quiet', 'good_natural_light'],
  tagLabels: ['Neighborhood Feel', 'Cosy', 'Aesthetic', 'Quiet', 'Good Natural Light'],
  fallbackBlurb:
    'Join the beta to save hidden gems, build your café diary, and get picks that match your vibe — not just the obvious chains.',
  showBrowseLink: true,
};

export const CAFE_DIARY_PAGE: PublicLandingPageConfig = {
  slug: 'cafe-diary',
  joinSource: 'cafe-diary',
  heroTitle: 'Start remembering the cafés you visit.',
  heroSubtitle:
    'Log your favourite spots, save photos from each visit, rate the experience, and build a personal coffee diary.',
  explanation:
    'Beaned is built for people who care where they drink coffee — not just where they worked today.',
  steps: [
    {
      title: 'Find a café',
      body: 'Browse picks for work, coffee quality, or neighbourhood vibe — then open the ones that feel right.',
    },
    {
      title: 'Log your visit',
      body: 'Rate the café, tag what stood out, and capture how it actually felt — not just the star rating.',
    },
    {
      title: 'Add photos and notes',
      body: 'Keep visit photos and short notes so you remember the seat, the light, and the order you loved.',
    },
    {
      title: 'Build your café memory map',
      body: 'Revisit your diary, compare spots, and share favourites with friends who get it.',
    },
  ],
  fallbackBlurb:
    'Join the beta to start your café diary — early testers get in first as we open access in small batches.',
  showBrowseLink: false,
};
