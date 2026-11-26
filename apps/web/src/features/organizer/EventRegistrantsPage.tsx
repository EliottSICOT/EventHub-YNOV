import { Link, useParams } from 'react-router';
import { useEvent } from '../../api/queries';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { formatDateTime } from '../events/format';
import { useEventRegistrants } from './api';
import { ExportRegistrationsButton } from './ExportRegistrationsButton';

/** Liste des inscrits d'un événement (US12), réservée à son organisateur. */
export function EventRegistrantsPage() {
  const { id = '' } = useParams();
  const event = useEvent(id);
  const registrants = useEventRegistrants(id);

  if (event.isPending || registrants.isPending) {
    return <Spinner label="Chargement des inscrits…" />;
  }

  if (event.isError || registrants.isError) {
    const refetch = () => {
      void event.refetch();
      void registrants.refetch();
    };
    return (
      <StatusMessage variant="error" title="Impossible de charger les inscrits">
        <button type="button" className="button" onClick={refetch}>
          Réessayer
        </button>
        <Link to="/organisateur">Retour au tableau de bord</Link>
      </StatusMessage>
    );
  }

  const { data } = registrants;

  return (
    <section className="page">
      <header className="page__header page__header--row">
        <div>
          <p className="muted">
            <Link to="/organisateur">Mes événements</Link>
          </p>
          <h1>Inscrits · {event.data.title}</h1>
          <p className="muted">
            <time dateTime={event.data.startsAt}>{formatDateTime(event.data.startsAt)}</time>
          </p>
        </div>
        <ExportRegistrationsButton eventId={id} />
      </header>

      {data.length === 0 ? (
        <StatusMessage title="Aucun inscrit pour le moment">
          <p>Dès qu'un participant s'inscrit, il apparaîtra ici.</p>
          <Link to="/organisateur" className="button button--ghost">
            Retour au tableau de bord
          </Link>
        </StatusMessage>
      ) : (
        <div className="registrants">
          <table className="registrants__table">
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Prénom</th>
                <th scope="col">Email</th>
                <th scope="col">Date d'inscription</th>
              </tr>
            </thead>
            <tbody>
              {data.map((person) => (
                <tr key={`${person.email}-${person.createdAt}`}>
                  <td>{person.lastName}</td>
                  <td>{person.firstName}</td>
                  <td>
                    <a href={`mailto:${person.email}`}>{person.email}</a>
                  </td>
                  <td>
                    <time dateTime={person.createdAt}>{formatDateTime(person.createdAt)}</time>
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
