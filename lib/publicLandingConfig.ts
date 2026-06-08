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
  heroTitle: 'Jake’s favourite cafés to work from in London',
  heroSubtitle:
    'A personal shortlist of cafés I’d actually bring my laptop to — good coffee, decent atmosphere, and fewer awkward “should I be working here?” vibes.',
  explanation:
    'Based on Jake’s picks, with Beaned community ratings layered in.',
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
    'I’m still adding to this list. Join the beta to see work-friendly picks as they go live — and build your own shortlist.',
  showBrowseLink: true,
};

export const BEST_COFFEE_LONDON_PAGE: PublicLandingPageConfig = {
  slug: 'best-coffee-london',
  joinSource: 'best-coffee-london',
  heroTitle: 'Jake’s favourite coffee spots in London',
  heroSubtitle:
    'Places I’d send a friend who cares about the coffee itself — espresso, filter, beans, and everything in between.',
  explanation:
    'Based on Jake’s picks, with Beaned community ratings layered in.',
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
    'More spots coming soon. Join the beta to follow along as I add the places I’d actually recommend for the coffee.',
  showBrowseLink: true,
};

export const HIDDEN_GEM_CAFES_PAGE: PublicLandingPageConfig = {
  slug: 'hidden-gem-cafes',
  joinSource: 'hidden-gem-cafes',
  heroTitle: 'Jake’s favourite hidden-gem cafés in London',
  heroSubtitle:
    'Neighbourhood spots, tucked-away corners, and cafés that feel worth remembering.',
  explanation:
    'Based on Jake’s picks, with Beaned community ratings layered in.',
  tagSlugs: ['neighborhood_feel', 'cosy', 'aesthetic', 'quiet', 'good_natural_light'],
  tagLabels: ['Neighborhood Feel', 'Cosy', 'Aesthetic', 'Quiet', 'Good Natural Light'],
  fallbackBlurb:
    'I’m still building this list. Join the beta to save the gems you find and keep your own running shortlist.',
  showBrowseLink: true,
};

export const CAFE_DIARY_PAGE: PublicLandingPageConfig = {
  slug: 'cafe-diary',
  joinSource: 'cafe-diary',
  heroTitle: 'Start your own café diary',
  heroSubtitle:
    'I started Beaned because I kept forgetting the cafés I loved. Track where you’ve been, what you ordered, and the places you want to come back to.',
  explanation:
    'Same idea I use myself — a simple log for the cafés worth remembering.',
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
    'Join the beta to start yours — early testers get in first while I’m opening access in small batches.',
  showBrowseLink: false,
};
