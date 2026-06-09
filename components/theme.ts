/**
 * Global design tokens — editorial cream canvas, black type & actions (Framer-aligned).
 * Playfair: large headings & optional display names only (see FONTS.display).
 */

export const COLORS = {
  /** Warm cream app canvas */
  background: '#FFFBF0',
  /** Primary text */
  text: '#000000',
  /** Primary actions, active nav, emphasis (black — not orange) */
  accent: '#000000',
  /** Warm brown for secondary emphasis on tags/labels */
  roastedBrown: '#6B5E52',
  sage: '#8a9a7e',
  /** Muted secondary text — dark warm grey */
  muted: '#5C5348',

  /** Soft warm neutral borders */
  cardBorder: '#E8E0D4',

  inputBackground: '#FFFBF0',
  /** Warm highlight panels — café cards, notes, highlights */
  cardBackground: '#FFF5E0',
  imagePlaceholder: '#EDE6DA',
  /** Unselected filter chips — border-forward, no grey fill */
  chipBackground: 'transparent',
  tagBackground: 'transparent',
  /** Quieter editorial tag borders */
  tagSecondaryBorder: '#C9B89A',

  /** Insight / highlight callouts on cards */
  coffeePillBackground: '#FFF5E0',
  coffeePillBorder: '#E0D4C4',
  /** Primary button label on black */
  buttonLabelOnAccent: '#FFFFFF',
  /** Selected chips / toggles */
  accentSubtleFill: 'rgba(0, 0, 0, 0.06)',
  accentSubtleBorder: 'rgba(0, 0, 0, 0.14)',
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
    shadowColor: '#000000',
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
