/**
 * Global design tokens — editorial, minimal (warm off-white, terracotta accent, Inter + Playfair).
 * Playfair: large headings & optional display names only (see FONTS.display).
 */

export const COLORS = {
  /** Warm off-white app canvas */
  background: '#f6f4f0',
  /** Near-black primary text */
  text: '#1a1a1a',
  /** Terracotta — use sparingly (tabs, selected chips, highlights) */
  accent: '#e15c31',
  /** Warm brown for secondary emphasis (less prominent than accent) */
  roastedBrown: '#7a6352',
  sage: '#8a9a7e',
  muted: '#5c5650',

  /** Very subtle warm gray borders */
  cardBorder: '#e8e4de',

  inputBackground: '#faf8f5',
  /** Card surfaces: clean white on warm background */
  cardBackground: '#ffffff',
  imagePlaceholder: '#ebe6df',
  chipBackground: '#f3ede6',
  tagBackground: '#f6f4f0',

  coffeePillBackground: 'rgba(225, 92, 49, 0.08)',
  coffeePillBorder: 'rgba(225, 92, 49, 0.22)',
  workPillBackground: 'rgba(138, 154, 126, 0.12)',
  workPillBorder: 'rgba(138, 154, 126, 0.28)',
} as const;

/**
 * Font family names must match `useFonts` in `app/_layout.tsx`.
 * Default UI: Inter. Display: Playfair for large headings & optional cafe names.
 */
export const FONTS = {
  sans: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  display: {
    semibold: 'PlayfairDisplay_600SemiBold',
    bold: 'PlayfairDisplay_700Bold',
  },
} as const;

/** Minimal elevation — avoid heavy “tech” shadows */
export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** Barely-there card separation */
  card: {
    shadowColor: '#1a1a1a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export const SPACING = {
  sectionGap: 22,
  cardPadding: 16,
} as const;
