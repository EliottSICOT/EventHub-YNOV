import { Button } from '@heroui/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useCategories, useEvents } from '../../api/queries';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { pageSubtitle, pageTitle } from '../../components/ui';
import { EventCard } from './EventCard';
import { EventFilters } from './EventFilters';
import {
  filtersFromSearchParams,
  hasActiveFilters,
  updateSearchParams,
  type FilterChanges,
} from './filters';
import { Pagination } from './Pagination';

/** Écran « Liste des événements » (US01, US02, US10). */
export function EventListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const events = useEvents(filters);
  const categories = useCategories();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useDocumentTitle('Événements à venir');

  const changeFilters = useCallback(
    (changes: FilterChanges) => setSearchParams((current) => updateSearchParams(current, changes)),
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
    // Le bouton cliqué peut devenir inactif (première ou dernière page) : sans cela, le focus
    // clavier retomberait sur la page entière (2.4.3). On le place sur le titre.
    headingRef.current?.focus();
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 ref={headingRef} tabIndex={-1} className={`${pageTitle} outline-none`}>
          Événements à venir
        </h1>
        {events.data && (
          <p className={pageSubtitle} aria-live="polite">
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
          <Button onPress={() => void events.refetch()}>Réessayer</Button>
        </StatusMessage>
      ) : events.data.data.length === 0 ? (
        <StatusMessage title="Aucun événement">
          {hasActiveFilters(filters) && <p>Aucun événement ne correspond à ces filtres.</p>}
        </StatusMessage>
      ) : (
        <>
          <ul
            className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${events.isFetching ? 'opacity-60' : ''}`}
            aria-busy={events.isFetching}
          >
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
