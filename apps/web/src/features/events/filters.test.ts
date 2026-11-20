import { filtersFromSearchParams, hasActiveFilters, updateSearchParams } from './filters';

describe('filtersFromSearchParams', () => {
  it('lit les filtres et ignore les valeurs vides', () => {
    const params = new URLSearchParams('category=concert&city=%20&from=2026-12-01&page=2&foo=bar');
    expect(filtersFromSearchParams(params)).toEqual({
      category: 'concert',
      from: '2026-12-01',
      page: 2,
    });
  });

  it('ignore une page invalide', () => {
    expect(filtersFromSearchParams(new URLSearchParams('page=abc'))).toEqual({});
  });
});

describe('updateSearchParams', () => {
  it('ramène à la page 1 quand un filtre change', () => {
    const next = updateSearchParams(new URLSearchParams('page=3&city=Lyon'), { category: 'sport' });
    expect(next.toString()).toBe('city=Lyon&category=sport');
  });

  it('supprime un filtre vidé', () => {
    const next = updateSearchParams(new URLSearchParams('city=Lyon'), { city: undefined });
    expect(next.toString()).toBe('');
  });

  it('conserve les filtres quand seule la page change', () => {
    const next = updateSearchParams(new URLSearchParams('city=Lyon'), { page: 2 });
    expect(next.toString()).toBe('city=Lyon&page=2');
  });
});

it('hasActiveFilters ignore la page', () => {
  expect(hasActiveFilters({ page: 2 })).toBe(false);
  expect(hasActiveFilters({ city: 'Lyon' })).toBe(true);
});
