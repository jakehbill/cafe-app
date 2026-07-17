/**
 * Tiered search scorer tests — run with: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Cafe } from '../data/cafes';
import {
  SEARCH_TIER,
  SEARCH_THRESHOLDS,
  cafeMatchesSearchQueryFromIndex,
  rankCafesBySearchQuery,
  scoreSearchableCafe,
  buildSearchableCafe,
  containsWholeWord,
} from './cafeSearchIndex';
import { parseCafeSearchQuery } from './cafeSearchQuery';

function cafe(partial: Partial<Cafe> & Pick<Cafe, 'id' | 'name'>): Cafe {
  return {
    neighborhood: '',
    latitude: 51.5,
    longitude: -0.1,
    venueType: 'cafe',
    status: 'active',
    isCertified: false,
    coffeeScore: 0,
    workScore: 0,
    vibeScore: 0,
    publicCoffeeScore: null,
    coffeeRatingCount: 0,
    tags: [],
    short_description: '',
    ...partial,
  };
}

function score(c: Cafe, query: string) {
  return scoreSearchableCafe(buildSearchableCafe(c), parseCafeSearchQuery(query));
}

const origin = cafe({
  id: '1',
  name: 'Origin Coffee',
  neighborhood: 'Shoreditch',
  addressLine: '65 Charlotte Rd, London',
  publicCoffeeScore: 9.2,
  coffeeScore: 9.2,
  isCertified: true,
});

const coffeeIsland = cafe({
  id: '2',
  name: 'Coffee Island',
  neighborhood: 'Soho',
  addressLine: '12 Wardour St, London',
  publicCoffeeScore: 8.0,
  coffeeScore: 8.0,
});

const kneesUp = cafe({
  id: '3',
  name: 'Knees Up',
  neighborhood: 'Bethnal Green',
  addressLine: '455 Hackney Rd, London E2 9DY',
  publicCoffeeScore: 10,
  coffeeScore: 10,
  isCertified: true,
});

const shoreditchHouse = cafe({
  id: '4',
  name: 'Workshop Coffee',
  neighborhood: 'Shoreditch',
  addressLine: '1 Clerkenwell Rd, London',
});

const sohoCafe = cafe({
  id: '5',
  name: 'Flat White Lab',
  neighborhood: 'Soho',
  addressLine: '88 Berwick St, London',
});

const catalog = [origin, coffeeIsland, kneesUp, shoreditchHouse, sohoCafe];

describe('containsWholeWord', () => {
  it('matches whole words only', () => {
    assert.equal(containsWholeWord('origin coffee', 'coffee'), true);
    assert.equal(containsWholeWord('coffee island', 'coffee'), true);
    assert.equal(containsWholeWord('coffeeshop', 'coffee'), false);
  });
});

describe('tiered search ranking', () => {
  it('exact name match is tier exactName and ranks first', () => {
    const s = score(origin, 'Origin Coffee');
    assert.equal(s.tier, SEARCH_TIER.exactName);
    const ranked = rankCafesBySearchQuery(catalog, 'Origin Coffee');
    assert.equal(ranked[0]?.cafe.name, 'Origin Coffee');
    assert.equal(ranked[0]?.tier, SEARCH_TIER.exactName);
  });

  it('prefix name match ranks above later whole-word match', () => {
    const prefix = score(coffeeIsland, 'Coffee');
    const whole = score(origin, 'Coffee');
    assert.equal(prefix.tier, SEARCH_TIER.prefixName);
    assert.equal(whole.tier, SEARCH_TIER.wholeWordName);
    assert.ok(prefix.tier > whole.tier);

    const ranked = rankCafesBySearchQuery(catalog, 'Coffee');
    assert.equal(ranked[0]?.cafe.name, 'Coffee Island');
    assert.ok(ranked.some((r) => r.cafe.name === 'Origin Coffee'));
  });

  it('whole-word name match works for non-prefix names', () => {
    const s = score(origin, 'Coffee');
    assert.equal(s.tier, SEARCH_TIER.wholeWordName);
    assert.ok(cafeMatchesSearchQueryFromIndex(origin, 'Coffee'));
  });

  it('neighbourhood / area match', () => {
    const s = score(kneesUp, 'Bethnal Green');
    assert.equal(s.tier, SEARCH_TIER.area);
    const ranked = rankCafesBySearchQuery(catalog, 'Shoreditch');
    assert.ok(ranked.length >= 1);
    assert.ok(ranked.every((r) => r.tier >= SEARCH_TIER.area || r.cafe.neighborhood === 'Shoreditch'));
    assert.ok(ranked.some((r) => r.cafe.neighborhood === 'Shoreditch'));
  });

  it('street / address match', () => {
    const s = score(kneesUp, 'Hackney Rd');
    assert.ok(s.tier >= SEARCH_TIER.street);
    const ranked = rankCafesBySearchQuery(catalog, 'Charlotte Rd');
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]?.cafe.name, 'Origin Coffee');
  });

  it('typo tolerance: Origin Cofee finds Origin Coffee via high-confidence fuzzy', () => {
    const s = score(origin, 'Origin Cofee');
    assert.ok(s.tier >= SEARCH_TIER.fuzzy);
    const ranked = rankCafesBySearchQuery(catalog, 'Origin Cofee');
    assert.ok(ranked.some((r) => r.cafe.name === 'Origin Coffee'));
    assert.equal(ranked[0]?.cafe.name, 'Origin Coffee');
  });

  it('weak unmatched query returns zero results', () => {
    const ranked = rankCafesBySearchQuery(catalog, 'xyzzyplugh');
    assert.equal(ranked.length, 0);
  });

  it('Bethwall alone returns zero results (no single-token area fuzzy)', () => {
    assert.equal(SEARCH_THRESHOLDS.allowSingleTokenAreaFuzzy, false);
    const ranked = rankCafesBySearchQuery(catalog, 'Bethwall');
    assert.equal(ranked.length, 0);
  });

  it('Bethwall Green does not return weak one-token matches', () => {
    // Only “green” must not surface Soho / Shoreditch cafés.
    const ranked = rankCafesBySearchQuery(catalog, 'Bethwall Green');
    for (const r of ranked) {
      const area = r.cafe.neighborhood.toLowerCase();
      assert.ok(
        area.includes('bethnal') || area.includes('green'),
        `unexpected result ${r.cafe.name} in ${r.cafe.neighborhood}`
      );
    }
    // Prefer Bethnal Green venue when fuzzy coverage succeeds; otherwise empty is OK.
    if (ranked.length > 0) {
      assert.ok(ranked.some((r) => r.cafe.id === kneesUp.id));
    }
  });

  it('fuzzy never outranks exact / prefix / whole-word / area / street', () => {
    const exact = score(origin, 'Origin Coffee');
    const fuzzy = score(origin, 'Origin Cofee');
    assert.ok(exact.tier > fuzzy.tier || exact.tier === SEARCH_TIER.exactName);
    assert.ok(exact.score > fuzzy.score);
  });

  it('tie-breakers: Beaned Pick and Work Score after relevance', () => {
    const a = cafe({
      id: 'a',
      name: 'Twin Spot',
      neighborhood: 'Soho',
      isCertified: false,
      publicCoffeeScore: 7,
      coffeeScore: 7,
    });
    const b = cafe({
      id: 'b',
      name: 'Twin Spot East',
      neighborhood: 'Soho',
      isCertified: true,
      publicCoffeeScore: 7,
      coffeeScore: 7,
    });
    const ranked = rankCafesBySearchQuery([a, b], 'Soho');
    assert.ok(ranked.length >= 2);
    // Same tier (area); certified should win tie-break
    const sohoMatches = ranked.filter((r) => r.cafe.neighborhood === 'Soho');
    assert.equal(sohoMatches[0]?.cafe.isCertified, true);
  });
});
