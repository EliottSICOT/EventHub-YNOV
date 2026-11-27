import { useState } from 'react';
import { Link } from 'react-router';
import type { OrganizerEvent } from '../../api/types';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import {
  linkButton,
  listRow,
  listRowMeta,
  listRowSide,
  listRowTitle,
  listRows,
  listSection,
  pageTitle,
  sectionTitle,
} from '../../components/ui';
import { formatDateTime } from '../events/format';
import { useMyEvents } from './api';
import { ExportRegistrationsButton } from './ExportRegistrationsButton';
import { Button, Chip } from '@heroui/react';

/** Tableau de bord organisateur (US12) : remplissage de mes événements, à venir et passés. */
export function OrganizerDashboardPage() {
  const { data, isPending, isError, refetch } = useMyEvents();
  const [now] = useState(() => Date.now());
  useDocumentTitle('Mes événements');

  if (isPending) return <Spinner label="Chargement de vos événements…" />;

  if (isError) {
    return (
      <StatusMessage variant="error" title="Impossible de charger vos événements">
        <Button onPress={() => void refetch()}>Réessayer</Button>
      </StatusMessage>
    );
  }

  const upcoming = data.filter((event) => new Date(event.startsAt).getTime() > now);
  const past = data.filter((event) => new Date(event.startsAt).getTime() <= now).reverse();

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={pageTitle}>Mes événements</h1>
        <Link to="/organisateur/evenements/nouveau" className={linkButton()}>
          Créer un événement
        </Link>
      </header>

      {data.length === 0 ? (
        <StatusMessage title="Vous n'avez encore aucun événement">
          <p>Créez votre premier événement pour suivre son remplissage ici.</p>
          <Link to="/organisateur/evenements/nouveau" className={linkButton()}>
            Créer un événement
          </Link>
        </StatusMessage>
      ) : (
        <>
          <EventGroup title="À venir" events={upcoming} />
          <EventGroup title="Passés" events={past} />
        </>
      )}
    </section>
  );
}

interface EventGroupProps {
  title: string;
  events: OrganizerEvent[];
}

function EventGroup({ title, events }: EventGroupProps) {
  if (events.length === 0) return null;
  return (
    <section className={listSection} aria-label={title}>
      <h2 className={sectionTitle}>{title}</h2>
      <ul className={listRows}>
        {events.map((event) => (
          <li key={event.id} className={listRow}>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className={listRowTitle}>
                <Link to={`/events/${event.id}`} className="no-underline hover:underline">
                  {event.title}
                </Link>
              </h3>
              <p className={listRowMeta}>
                <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
              </p>
              <p className={listRowMeta}>
                {event.registeredCount} / {event.capacity}{' '}
                {event.registeredCount === 1 ? 'inscrit' : 'inscrits'} · {event.fillRate}&nbsp;% de
                remplissage
              </p>
              {/* Barre décorative : le taux est déjà donné en texte juste au-dessus. */}
              <div
                aria-hidden="true"
                className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-default"
              >
                <div
                  className="fill-gradient h-full rounded-full"
                  style={{ width: `${Math.min(100, event.fillRate)}%` }}
                />
              </div>
            </div>
            <div className={listRowSide}>
              {event.isCancelled ? (
                <Chip color="danger" variant="soft" size="sm" className="font-semibold">
                  Annulé
                </Chip>
              ) : (
                <Chip color="accent" variant="soft" size="sm" className="font-semibold">
                  {event.fillRate}&nbsp;%
                </Chip>
              )}
              <Link
                to={`/organisateur/evenements/${event.id}/inscrits`}
                className={linkButton('outline', 'sm')}
              >
                Voir les inscrits
              </Link>
              <ExportRegistrationsButton eventId={event.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
