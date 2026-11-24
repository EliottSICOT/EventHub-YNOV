import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useCategories, useEvents } from '../../api/queries';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { EventCard } from './EventCard';
import { EventFilters } from './EventFilters';
import {
  filtersFromSearchParams,
  hasActiveFilters,
  updateSearchParams,
  type FilterKey,
} from './filters';
import { Pagination } from './Pagination';

/** Écran « Liste des événements » (US01, US02). */
export function EventListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const events = useEvents(filters);
  const categories = useCategories();

  const changeFilters = useCallback(
    (changes: Partial<Record<FilterKey, string | undefined>>) =>
      setSearchParams((current) => updateSearchParams(current, changes)),
    [setSearchParams],
  );
  // Page hors bornes (ancien lien, ?page=99…) : on remplace la page de l'URL par la dernière
  // existante, sans ajouter d'entrée à l'historique.
  const meta = events.data?.meta;
  const lastPage =
    meta && !events.isPlaceholderData && meta.total > 0 && meta.page > meta.totalPages
      ? meta.totalPages
      : undefined;
  useEffect(() => {
    if (lastPage === undefined) return;
    setSearchParams((current) => updateSearchParams(current, { page: lastPage }), {
      replace: true,
    });
  }, [lastPage, setSearchParams]);

  const changePage = (page: number) => {
    setSearchParams((current) => updateSearchParams(current, { page }));
    window.scrollTo?.({ top: 0 });
  };

  return (
    <section className="page">
      <header className="page__header">
        <h1>Événements à venir</h1>
        {events.data && (
          <p className="page__subtitle" aria-live="polite">
            {events.data.meta.total} événement{events.data.meta.total > 1 ? 's' : ''}
          </p>
        )}
      </header>

      <EventFilters
        value={filters}
        categories={categories.data ?? []}
        onChange={changeFilters}
        onReset={() => setSearchParams(new URLSearchParams())}
      />

      {events.isPending || lastPage !== undefined ? (
        <Spinner label="Chargement des événements…" />
      ) : events.isError ? (
        <StatusMessage variant="error" title="Impossible de charger les événements">
          <p>Vérifiez votre connexion puis réessayez.</p>
          <button type="button" className="button" onClick={() => void events.refetch()}>
            Réessayer
          </button>
        </StatusMessage>
      ) : events.data.data.length === 0 ? (
        <StatusMessage title="Aucun événement">
          {hasActiveFilters(filters) && <p>Aucun événement ne correspond à ces filtres.</p>}
        </StatusMessage>
      ) : (
        <>
          <ul className="grid" aria-busy={events.isFetching}>
            {events.data.data.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
          <Pagination
            page={events.data.meta.page}
            totalPages={events.data.meta.totalPages}
            onPageChange={changePage}
          />
        </>
      )}
    </section>
  );
}
