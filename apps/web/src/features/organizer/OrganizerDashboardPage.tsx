import { useState } from 'react';
import { Link } from 'react-router';
import type { OrganizerEvent } from '../../api/types';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { formatDateTime } from '../events/format';
import { useMyEvents } from './api';

/** Affiche « 42 / 300 » et le taux de remplissage. */
function fillLabel(event: OrganizerEvent): string {
  return `${event.registeredCount} / ${event.capacity} · ${event.fillRate} %`;
}

/**
 * Tableau de bord organisateur (US12) : mes événements, à venir et passés,
 * avec le remplissage et un lien vers la liste des inscrits.
 */
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
  const past = data
    .filter((event) => new Date(event.startsAt).getTime() <= now)
    .slice()
    .reverse();

  return (
    <section className="page">
      <header className="page__header page__header--row">
        <div>
          <h1>Mes événements</h1>
          <p className="page__subtitle">Suivez le remplissage de vos événements.</p>
        </div>
        <Link to="/organisateur/evenements/nouveau" className="button">
          Créer un événement
        </Link>
      </header>

      {data.length === 0 ? (
        <StatusMessage title="Vous n'avez encore aucun événement">
          <p>Créez votre premier événement pour le voir apparaître ici.</p>
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
    <section className="dashboard" aria-label={title}>
      <h2 className="dashboard__title">{title}</h2>
      <div className="dashboard__table-wrap">
        <table className="dashboard__table">
          <thead>
            <tr>
              <th scope="col">Événement</th>
              <th scope="col">Date</th>
              <th scope="col">Inscrits</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <th scope="row">{event.title}</th>
                <td>
                  <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
                </td>
                <td>
                  <span title={`Taux de remplissage : ${event.fillRate} %`}>
                    {fillLabel(event)}
                  </span>
                </td>
                <td>
                  <Link
                    to={`/organisateur/evenements/${event.id}/inscrits`}
                    className="button button--ghost button--small"
                  >
                    Voir les inscrits
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
