import { useCallback, useId } from 'react';
import type { Category } from '../../api/types';
import {
  DEFAULT_SORT,
  hasActiveFilters,
  SORT_LABELS,
  todayLocalDate,
  type EventFilters as Filters,
  type FilterChanges,
} from './filters';
import { useDebouncedText } from './useDebouncedText';

interface EventFiltersProps {
  value: Filters;
  categories: Category[];
  onChange: (changes: FilterChanges) => void;
  onReset: () => void;
  /** Pause de frappe avant d'appliquer la recherche ou la ville. */
  debounceMs?: number;
}

/** Barre du catalogue : recherche et tri (US10), période, catégorie et ville (US02). */
export function EventFilters({
  value,
  categories,
  onChange,
  onReset,
  debounceMs = 300,
}: EventFiltersProps) {
  const id = useId();
  const applyCity = useCallback((city: string | undefined) => onChange({ city }), [onChange]);
  const applySearch = useCallback((q: string | undefined) => onChange({ q }), [onChange]);
  const [city, setCity] = useDebouncedText(value.city, applyCity, debounceMs);
  const [search, setSearch] = useDebouncedText(value.q, applySearch, debounceMs);

  const canReset = hasActiveFilters(value) || value.sort !== undefined;

  return (
    <form
      className="filters"
      role="search"
      aria-label="Filtrer les événements"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="filters__field filters__field--search">
        <label htmlFor={`${id}-q`}>Rechercher</label>
        <input
          id={`${id}-q`}
          type="search"
          placeholder="Un mot du titre ou de la description"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="filters__field">
        <label htmlFor={`${id}-sort`}>Trier par</label>
        <select
          id={`${id}-sort`}
          value={value.sort ?? DEFAULT_SORT}
          onChange={(e) => onChange({ sort: e.target.value })}
        >
          {Object.entries(SORT_LABELS).map(([sort, label]) => (
            <option key={sort} value={sort}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="filters__field">
        <label htmlFor={`${id}-from`}>Du</label>
        <input
          id={`${id}-from`}
          type="date"
          value={value.from ?? ''}
          min={todayLocalDate()}
          max={value.to}
          onChange={(e) => onChange({ from: e.target.value || undefined })}
        />
      </div>
      <div className="filters__field">
        <label htmlFor={`${id}-to`}>Au</label>
        <input
          id={`${id}-to`}
          type="date"
          value={value.to ?? ''}
          min={value.from}
          onChange={(e) => onChange({ to: e.target.value || undefined })}
        />
      </div>
      <div className="filters__field">
        <label htmlFor={`${id}-category`}>Catégorie</label>
        <select
          id={`${id}-category`}
          value={value.category ?? ''}
          onChange={(e) => onChange({ category: e.target.value || undefined })}
        >
          <option value="">Toutes</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filters__field filters__field--grow">
        <label htmlFor={`${id}-city`}>Ville</label>
        <input
          id={`${id}-city`}
          type="search"
          placeholder="Lyon, Paris…"
          value={city}
          maxLength={100}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <button type="button" className="button button--ghost" onClick={onReset} disabled={!canReset}>
        Réinitialiser
      </button>
    </form>
  );
}
