import type { Cafe } from '@/data/cafes';
import {
  VENUE_TYPE_OPTIONS,
  type VenueTypeValue,
} from '@/lib/venueTypes';

/** `null` means “All” for every dimension. */
export type CollectionFilterState = {
  area: string | null;
  venueType: VenueTypeValue | null;
  /** When true, only certified Beaned Picks. */
  beanedPicksOnly: boolean;
};

export const DEFAULT_COLLECTION_FILTERS: CollectionFilterState = {
  area: null,
  venueType: null,
  beanedPicksOnly: false,
};

export function hasActiveCollectionFilters(filters: CollectionFilterState): boolean {
  return filters.area != null || filters.venueType != null || filters.beanedPicksOnly;
}

export function uniqueSortedAreas(cafes: Cafe[]): string[] {
  const set = new Set<string>();
  for (const cafe of cafes) {
    const area = (cafe.neighborhood ?? '').trim();
    if (area.length > 0) set.add(area);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Workspace types present in the collection, ordered like `VENUE_TYPE_OPTIONS`. */
export function uniqueVenueTypesInCollection(cafes: Cafe[]): VenueTypeValue[] {
  const present = new Set<VenueTypeValue>();
  for (const cafe of cafes) {
    present.add(cafe.venueType);
  }
  return VENUE_TYPE_OPTIONS.map((opt) => opt.value).filter((value) => present.has(value));
}

/** AND-combine area, workspace type, and Beaned Pick. Preserves input order. */
export function filterCafesByCollectionFilters(
  cafes: Cafe[],
  filters: CollectionFilterState
): Cafe[] {
  return cafes.filter((cafe) => {
    if (filters.area != null) {
      if ((cafe.neighborhood ?? '').trim() !== filters.area) return false;
    }
    if (filters.venueType != null) {
      if (cafe.venueType !== filters.venueType) return false;
    }
    if (filters.beanedPicksOnly && !cafe.isCertified) {
      return false;
    }
    return true;
  });
}
