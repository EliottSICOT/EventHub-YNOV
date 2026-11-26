import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { formatDateTime } from '../events/format';
import { useEventAttendees, useMyEvents } from './api';

/** Écran « Inscrits » d'un événement (US12), réservé à son organisateur. */
export function EventAttendeesPage() {
  const { id = '' } = useParams();
  const attendees = useEventAttendees(id);
  const myEvents = useMyEvents();
  const event = myEvents.data?.find((item) => item.id === id);

  if (attendees.isPending || (myEvents.isPending && !event)) {
    return <Spinner label="Chargement des inscrits…" />;
  }

  if (attendees.isError) {
    const status = attendees.error instanceof ApiError ? attendees.error.status : undefined;
    if (status === 404) {
      return (
        <StatusMessage variant="error" title="Événement introuvable">
          <Link to="/organisateur/evenements" className="button">
            Retour à mes événements
          </Link>
        </StatusMessage>
      );
    }
    if (status === 403) {
      return (
        <StatusMessage variant="error" title="Accès refusé">
          <p>Seul l&apos;organisateur de cet événement peut consulter ses inscrits.</p>
          <Link to="/organisateur/evenements" className="button">
            Retour à mes événements
          </Link>
        </StatusMessage>
      );
    }
    return (
      <StatusMessage variant="error" title="Impossible de charger les inscrits">
        <button type="button" className="button" onClick={() => void attendees.refetch()}>
          Réessayer
        </button>
      </StatusMessage>
    );
  }

  const list = attendees.data;

  return (
    <section className="page">
      <header className="page__header">
        <p className="page__eyebrow">
          <Link to="/organisateur/evenements">Mes événements</Link>
        </p>
        <h1>Inscrits{event ? ` · ${event.title}` : ''}</h1>
        {event && (
          <p className="page__subtitle">
            <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
            {' · '}
            {event.registeredCount} / {event.capacity} ({event.fillRate} %)
          </p>
        )}
      </header>

      {list.length === 0 ? (
        <StatusMessage title="Aucun inscrit pour le moment">
          <p>Les participants qui s&apos;inscriront apparaîtront ici.</p>
        </StatusMessage>
      ) : (
        <div className="dashboard__table-wrap">
          <table className="dashboard__table">
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Prénom</th>
                <th scope="col">Email</th>
                <th scope="col">Date d&apos;inscription</th>
              </tr>
            </thead>
            <tbody>
              {list.map((attendee) => (
                <tr key={`${attendee.email}-${attendee.registeredAt}`}>
                  <td>{attendee.lastName}</td>
                  <td>{attendee.firstName}</td>
                  <td>
                    <a href={`mailto:${attendee.email}`}>{attendee.email}</a>
                  </td>
                  <td>
                    <time dateTime={attendee.registeredAt}>
                      {formatDateTime(attendee.registeredAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
