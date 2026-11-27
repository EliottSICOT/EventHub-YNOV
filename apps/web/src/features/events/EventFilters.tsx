import { Button, Surface } from '@heroui/react';
import { useCallback, useId } from 'react';
import { fieldInput, fieldLabel } from '../../components/ui';
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
    <Surface className="rounded-3xl p-4 sm:p-6">
      <form
        className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12"
        role="search"
        aria-label="Filtrer les événements"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-8">
          <label className={fieldLabel} htmlFor={`${id}-q`}>
            Rechercher
          </label>
          <input
            className={fieldInput}
            id={`${id}-q`}
            type="search"
            placeholder="Un mot du titre ou de la description"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
          <label className={fieldLabel} htmlFor={`${id}-sort`}>
            Trier par
          </label>
          <select
            className={fieldInput}
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
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label className={fieldLabel} htmlFor={`${id}-from`}>
            Du
          </label>
          <input
            className={fieldInput}
            id={`${id}-from`}
            type="date"
            value={value.from ?? ''}
            min={todayLocalDate()}
            max={value.to}
            onChange={(e) => onChange({ from: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label className={fieldLabel} htmlFor={`${id}-to`}>
            Au
          </label>
          <input
            className={fieldInput}
            id={`${id}-to`}
            type="date"
            value={value.to ?? ''}
            min={value.from}
            onChange={(e) => onChange({ to: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label className={fieldLabel} htmlFor={`${id}-category`}>
            Catégorie
          </label>
          <select
            className={fieldInput}
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
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label className={fieldLabel} htmlFor={`${id}-city`}>
            Ville
          </label>
          <input
            className={fieldInput}
            id={`${id}-city`}
            type="search"
            placeholder="Lyon, Paris…"
            value={city}
            maxLength={100}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="sm:col-span-2 lg:col-span-12 lg:justify-self-end"
          onPress={onReset}
          isDisabled={!canReset}
        >
          Réinitialiser
        </Button>
      </form>
    </Surface>
  );
}
