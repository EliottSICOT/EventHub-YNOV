import { useState } from 'react';
import { Link } from 'react-router';
import type { OrganizerEvent } from '../../api/types';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { formatDateTime } from '../events/format';
import { useMyEvents } from './api';
import { ExportRegistrationsButton } from './ExportRegistrationsButton';

/** Tableau de bord organisateur (US12) : remplissage de mes événements, à venir et passés. */
export function OrganizerDashboardPage() {
  const { data, isPending, isError, refetch } = useMyEvents();
  const [now] = useState(() => Date.now());

  if (isPending) return <Spinner label="Chargement de vos événements…" />;

  if (isError) {
    return (
      <StatusMessage variant="error" title="Impossible de charger vos événements">
        <button type="button" className="button" onClick={() => void refetch()}>
          Réessayer
        </button>
      </StatusMessage>
    );
  }

  const upcoming = data.filter((event) => new Date(event.startsAt).getTime() > now);
  const past = data.filter((event) => new Date(event.startsAt).getTime() <= now).reverse();

  return (
    <section className="page">
      <header className="page__header page__header--row">
        <h1>Mes événements</h1>
        <Link to="/organisateur/evenements/nouveau" className="button">
          Créer un événement
        </Link>
      </header>

      {data.length === 0 ? (
        <StatusMessage title="Vous n'avez encore aucun événement">
          <p>Créez votre premier événement pour suivre son remplissage ici.</p>
          <Link to="/organisateur/evenements/nouveau" className="button">
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
    <section className="registrations" aria-label={title}>
      <h2 className="registrations__title">{title}</h2>
      <ul className="registrations__list">
        {events.map((event) => (
          <li key={event.id} className="registration">
            <div className="registration__main">
              <h3 className="registration__name">
                <Link to={`/events/${event.id}`}>{event.title}</Link>
              </h3>
              <p className="registration__meta">
                <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
              </p>
              <p className="registration__meta">
                {event.registeredCount} / {event.capacity}{' '}
                {event.registeredCount === 1 ? 'inscrit' : 'inscrits'} · {event.fillRate}&nbsp;% de
                remplissage
              </p>
            </div>
            <div className="registration__side">
              {event.isCancelled ? (
                <span className="badge badge--full">Annulé</span>
              ) : (
                <span className="badge">{event.fillRate}&nbsp;%</span>
              )}
              <Link
                to={`/organisateur/evenements/${event.id}/inscrits`}
                className="button button--ghost button--small"
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
