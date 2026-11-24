import { useId } from 'react';
import { Link } from 'react-router';
import type { MyRegistration } from '../../api/types';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { useMyRegistrations } from './api';
import { RegistrationCard } from './RegistrationCard';

interface RegistrationSectionProps {
  title: string;
  empty: string;
  registrations: MyRegistration[];
}

function RegistrationSection({ title, empty, registrations }: RegistrationSectionProps) {
  const headingId = useId();
  return (
    <section className="registrations" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {registrations.length === 0 ? (
        <p className="registrations__empty">{empty}</p>
      ) : (
        <ul className="grid">
          {registrations.map((registration) => (
            <li key={registration.id}>
              <RegistrationCard registration={registration} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Écran « Mes inscriptions » (US07), réservé aux utilisateurs connectés (`RequireAuth`). */
export function MyRegistrationsPage() {
  const { data, isPending, isError, refetch } = useMyRegistrations();

  return (
    <section className="page">
      <header className="page__header">
        <h1>Mes inscriptions</h1>
      </header>

      {isPending ? (
        <Spinner label="Chargement de vos inscriptions…" />
      ) : isError ? (
        <StatusMessage variant="error" title="Impossible de charger vos inscriptions">
          <button type="button" className="button" onClick={() => void refetch()}>
            Réessayer
          </button>
        </StatusMessage>
      ) : data.upcoming.length + data.past.length === 0 ? (
        <StatusMessage title="Vous n'avez aucune inscription">
          <p>Trouvez un événement qui vous plaît et réservez votre place.</p>
          <Link to="/events" className="button">
            Voir le catalogue
          </Link>
        </StatusMessage>
      ) : (
        <>
          <RegistrationSection
            title="À venir"
            empty="Aucune inscription à venir."
            registrations={data.upcoming}
          />
          <RegistrationSection
            title="Passées"
            empty="Aucune inscription passée."
            registrations={data.past}
          />
        </>
      )}
    </section>
  );
}
