import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import type { UserRegistration } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { formatDateTime, formatPrice } from '../events/format';
import { SeatsBadge } from '../events/SeatsBadge';
import { useCancelRegistration, useMyRegistrations } from './api';

/** Message affiché quand l'annulation échoue. */
function cancelErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous pour annuler.';
    if (error.status === 404) return "Cette inscription n'existe plus.";
    if (error.status === 403 || error.status === 409) return error.message;
  }
  return "L'annulation a échoué. Réessayez dans un instant.";
}

/** Écran « Mes inscriptions » (US06, US07) : annulation avec confirmation des inscriptions à venir. */
export function MyRegistrationsPage() {
  const { data, isPending, isError, refetch } = useMyRegistrations();
  const cancel = useCancelRegistration();
  const [target, setTarget] = useState<UserRegistration | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const confirmCancellation = () => {
    if (!target) return;
    const { id, event } = target;
    cancel.mutate(id, {
      onSuccess: () =>
        setNotice(`Inscription à « ${event.title} » annulée : la place est libérée.`),
      onSettled: () => setTarget(null),
    });
  };

  const ask = (registration: UserRegistration) => {
    cancel.reset();
    setNotice(null);
    setTarget(registration);
  };

  if (isPending) return <Spinner label="Chargement de vos inscriptions…" />;

  if (isError) {
    return (
      <StatusMessage variant="error" title="Impossible de charger vos inscriptions">
        <button type="button" className="button" onClick={() => void refetch()}>
          Réessayer
        </button>
      </StatusMessage>
    );
  }

  const upcoming = data.filter((r) => new Date(r.event.startsAt).getTime() > now);
  const past = data.filter((r) => new Date(r.event.startsAt).getTime() <= now).reverse();

  return (
    <section className="page">
      <header className="page__header">
        <h1>Mes inscriptions</h1>
      </header>

      {notice && (
        <p className="notice notice--ok" role="status">
          {notice}
        </p>
      )}
      {cancel.isError && (
        <p className="notice notice--error" role="alert">
          {cancelErrorMessage(cancel.error)}
        </p>
      )}

      {data.length === 0 ? (
        <StatusMessage title="Vous n'êtes inscrit à aucun événement">
          <p>Parcourez le catalogue pour trouver votre prochaine sortie.</p>
          <Link to="/events" className="button">
            Voir les événements
          </Link>
        </StatusMessage>
      ) : (
        <>
          <RegistrationGroup title="À venir" registrations={upcoming} onCancel={ask} />
          <RegistrationGroup title="Passées" registrations={past} />
        </>
      )}

      {target && (
        <ConfirmDialog
          title="Annuler cette inscription ?"
          confirmLabel="Oui, annuler"
          cancelLabel="Garder mon inscription"
          pending={cancel.isPending}
          onConfirm={confirmCancellation}
          onCancel={() => setTarget(null)}
        >
          <p>
            Vous allez annuler votre inscription à <strong>{target.event.title}</strong> (
            {formatDateTime(target.event.startsAt)}). Votre place sera libérée pour les autres
            participants.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

interface RegistrationGroupProps {
  title: string;
  registrations: UserRegistration[];
  /** Absent pour les inscriptions passées : elles ne peuvent plus être annulées. */
  onCancel?: (registration: UserRegistration) => void;
}

function RegistrationGroup({ title, registrations, onCancel }: RegistrationGroupProps) {
  if (registrations.length === 0) return null;
  return (
    <section className="registrations" aria-label={title}>
      <h2 className="registrations__title">{title}</h2>
      <ul className="registrations__list">
        {registrations.map((registration) => {
          const { event } = registration;
          return (
            <li key={registration.id} className="registration">
              <div className="registration__main">
                <h3 className="registration__name">
                  <Link to={`/events/${event.id}`}>{event.title}</Link>
                </h3>
                <p className="registration__meta">
                  <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
                </p>
                <p className="registration__meta">
                  {event.venue} · {event.city} · {formatPrice(event.priceCents)}
                </p>
              </div>
              <div className="registration__side">
                {event.isCancelled ? (
                  <span className="badge badge--full">Événement annulé</span>
                ) : (
                  <SeatsBadge
                    remainingSeats={event.remainingSeats}
                    capacity={event.capacity}
                    isFull={event.isFull}
                  />
                )}
                {event.isCancelled ? null : onCancel ? (
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    aria-label={`Annuler l'inscription à ${event.title}`}
                    onClick={() => onCancel(registration)}
                  >
                    Annuler
                  </button>
                ) : (
                  <span className="muted">Terminé</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
