import { useEffect, useId, useState } from 'react';
import type { Category } from '../../api/types';
import { todayLocalDate, type EventFilters as Filters, type FilterKey } from './filters';

interface EventFiltersProps {
  value: Filters;
  categories: Category[];
  onChange: (changes: Partial<Record<FilterKey, string | undefined>>) => void;
  onReset: () => void;
  /** Délai avant d'appliquer la saisie de la ville. */
  cityDebounceMs?: number;
}

/** Barre de filtres du catalogue (US02) : période, catégorie, ville. */
export function EventFilters({
  value,
  categories,
  onChange,
  onReset,
  cityDebounceMs = 300,
}: EventFiltersProps) {
  const id = useId();
  const [city, setCity] = useState(value.city ?? '');
  const [syncedCity, setSyncedCity] = useState(value.city);

  // Garde le champ synchronisé avec l'URL (bouton Précédent, réinitialisation).
  if (value.city !== syncedCity) {
    setSyncedCity(value.city);
    setCity(value.city ?? '');
  }

  useEffect(() => {
    const next = city.trim() || undefined;
    if (next === value.city) return;
    const timer = setTimeout(() => onChange({ city: next }), cityDebounceMs);
    return () => clearTimeout(timer);
  }, [city, value.city, onChange, cityDebounceMs]);

  const hasFilters = Boolean(value.from || value.to || value.category || value.city);

  return (
    <form
      className="filters"
      role="search"
      aria-label="Filtrer les événements"
      onSubmit={(e) => e.preventDefault()}
    >
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
      <button
        type="button"
        className="button button--ghost"
        onClick={onReset}
        disabled={!hasFilters}
      >
        Réinitialiser
      </button>
    </form>
  );
}
