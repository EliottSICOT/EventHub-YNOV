/** Filtres du catalogue, reflétés dans l'URL (US02). */
export interface EventFilters {
  page?: number;
  from?: string;
  to?: string;
  category?: string;
  city?: string;
}

export const FILTER_KEYS = ['from', 'to', 'category', 'city'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const PAGE_SIZE = 12;

export function filtersFromSearchParams(params: URLSearchParams): EventFilters {
  const filters: EventFilters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }
  const page = Number(params.get('page'));
  if (Number.isInteger(page) && page > 1) filters.page = page;
  return filters;
}

/**
 * Applique une modification de filtres sur les paramètres d'URL.
 * Changer un filtre ramène à la première page.
 */
export function updateSearchParams(
  current: URLSearchParams,
  changes: Partial<Record<FilterKey | 'page', string | number | undefined>>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === '' || (key === 'page' && Number(value) <= 1)) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  if (!('page' in changes)) next.delete('page');
  return next;
}

export function hasActiveFilters(filters: EventFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key] !== undefined);
}
