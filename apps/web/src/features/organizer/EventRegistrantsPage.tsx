import { Link, useParams } from 'react-router';
import { useEvent } from '../../api/queries';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { linkButton, pageSubtitle, pageTitle, textLink } from '../../components/ui';
import { formatDateTime } from '../events/format';
import { useEventRegistrants } from './api';
import { ExportRegistrationsButton } from './ExportRegistrationsButton';
import { Button, Card } from '@heroui/react';

/** Liste des inscrits d'un événement (US12), réservée à son organisateur. */
export function EventRegistrantsPage() {
  const { id = '' } = useParams();
  const event = useEvent(id);
  const registrants = useEventRegistrants(id);
  useDocumentTitle(event.data ? `Inscrits · ${event.data.title}` : 'Inscrits');

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
        <Button onPress={refetch}>Réessayer</Button>
        <Link to="/organisateur" className={textLink}>
          Retour au tableau de bord
        </Link>
      </StatusMessage>
    );
  }

  const { data } = registrants;

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm">
            <Link to="/organisateur" className={textLink}>
              ← Mes événements
            </Link>
          </p>
          <h1 className={`${pageTitle} mt-2`}>Inscrits · {event.data.title}</h1>
          <p className={pageSubtitle}>
            <time dateTime={event.data.startsAt}>{formatDateTime(event.data.startsAt)}</time>
          </p>
        </div>
        <ExportRegistrationsButton eventId={id} />
      </header>

      {data.length === 0 ? (
        <StatusMessage title="Aucun inscrit pour le moment">
          <p>Dès qu'un participant s'inscrit, il apparaîtra ici.</p>
          <Link to="/organisateur" className={linkButton('outline')}>
            Retour au tableau de bord
          </Link>
        </StatusMessage>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-surface-secondary">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold text-foreground">
                  Nom
                </th>
                <th scope="col" className="px-5 py-3 font-semibold text-foreground">
                  Prénom
                </th>
                <th scope="col" className="px-5 py-3 font-semibold text-foreground">
                  Email
                </th>
                <th scope="col" className="px-5 py-3 font-semibold text-foreground">
                  Date d'inscription
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((person) => (
                <tr
                  key={`${person.email}-${person.createdAt}`}
                  className="border-t border-separator"
                >
                  <td className="px-5 py-3 text-foreground">{person.lastName}</td>
                  <td className="px-5 py-3 text-foreground">{person.firstName}</td>
                  <td className="px-5 py-3 text-foreground">
                    <a href={`mailto:${person.email}`} className={textLink}>
                      {person.email}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    <time dateTime={person.createdAt}>{formatDateTime(person.createdAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
