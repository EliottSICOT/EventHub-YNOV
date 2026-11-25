import type { EventSort } from '../../api/types';

/** Filtres, recherche et tri du catalogue, reflétés dans l'URL (US02, US10). */
export interface EventFilters {
  page?: number;
  from?: string;
  to?: string;
  category?: string;
  city?: string;
  q?: string;
  sort?: EventSort;
}

export const FILTER_KEYS = ['q', 'from', 'to', 'category', 'city'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** Modification de la barre de filtres : un filtre, la recherche ou le tri. */
export type FilterChanges = Partial<Record<FilterKey | 'sort', string | undefined>>;

/** Tri par défaut de l'API : absent de l'URL. */
export const DEFAULT_SORT: EventSort = 'date';

export const SORT_LABELS: Record<EventSort, string> = {
  date: 'Date : plus proche',
  '-date': 'Date : plus lointaine',
  price: 'Prix croissant',
  '-price': 'Prix décroissant',
  '-seats': 'Places restantes : plus au moins',
  seats: 'Places restantes : moins au plus',
};

const isSort = (value: string | null): value is EventSort =>
  value !== null && Object.hasOwn(SORT_LABELS, value);

export const PAGE_SIZE = 12;

export function filtersFromSearchParams(params: URLSearchParams): EventFilters {
  const filters: EventFilters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }
  const sort = params.get('sort');
  if (isSort(sort) && sort !== DEFAULT_SORT) filters.sort = sort;
  const page = Number(params.get('page'));
  if (Number.isInteger(page) && page > 1) filters.page = page;
  return filters;
}

/**
 * Applique une modification de filtres sur les paramètres d'URL.
 * Changer un filtre, la recherche ou le tri ramène à la première page.
 */
export function updateSearchParams(
  current: URLSearchParams,
  changes: FilterChanges & { page?: number },
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (
      value === undefined ||
      value === '' ||
      (key === 'sort' && value === DEFAULT_SORT) ||
      (key === 'page' && Number(value) <= 1)
    ) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  if (!('page' in changes)) next.delete('page');
  return next;
}

/** Date du jour en heure locale, au format `YYYY-MM-DD` des champs `<input type="date">`. */
export function todayLocalDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Vrai si les résultats sont restreints ; le tri, lui, n'en retire aucun. */
export function hasActiveFilters(filters: EventFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key] !== undefined);
}
