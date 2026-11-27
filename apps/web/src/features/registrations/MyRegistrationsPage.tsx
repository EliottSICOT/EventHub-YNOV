import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import type { UserRegistration, UserWaitlistEntry } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Notice } from '../../components/Notice';
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
import { formatDateTime, formatPrice } from '../events/format';
import { SeatsBadge } from '../events/SeatsBadge';
import { useCancelRegistration, useLeaveWaitlist, useMyRegistrations, useMyWaitlist } from './api';
import { Button, Chip } from '@heroui/react';

/** Message affiché quand l'annulation échoue. */
function cancelErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous pour annuler.';
    if (error.status === 404) return "Cette inscription n'existe plus.";
    if (error.status === 403 || error.status === 409) return error.message;
  }
  return "L'annulation a échoué. Réessayez dans un instant.";
}

/** Écran « Mes inscriptions » (US06, US07) + listes d'attente (US14). */
export function MyRegistrationsPage() {
  const registrations = useMyRegistrations();
  const waitlist = useMyWaitlist();
  const cancel = useCancelRegistration();
  const leaveWaitlist = useLeaveWaitlist();
  const [target, setTarget] = useState<UserRegistration | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  useDocumentTitle('Mes inscriptions');

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

  if (registrations.isPending || waitlist.isPending) {
    return <Spinner label="Chargement de vos inscriptions…" />;
  }

  if (registrations.isError) {
    return (
      <StatusMessage variant="error" title="Impossible de charger vos inscriptions">
        <Button onPress={() => void registrations.refetch()}>Réessayer</Button>
      </StatusMessage>
    );
  }

  const data = registrations.data;
  const waiting = waitlist.data ?? [];
  const upcoming = data.filter((r) => new Date(r.event.startsAt).getTime() > now);
  const past = data.filter((r) => new Date(r.event.startsAt).getTime() <= now).reverse();

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className={pageTitle}>Mes inscriptions</h1>
      </header>

      {notice && (
        <Notice tone="success" role="status">
          {notice}
        </Notice>
      )}
      {cancel.isError && (
        <Notice tone="danger" role="alert">
          {cancelErrorMessage(cancel.error)}
        </Notice>
      )}
      {leaveWaitlist.isError && (
        <Notice tone="danger" role="alert">
          Impossible de quitter la liste d'attente. Réessayez.
        </Notice>
      )}

      {data.length === 0 && waiting.length === 0 ? (
        <StatusMessage title="Vous n'êtes inscrit à aucun événement">
          <p>Parcourez le catalogue pour trouver votre prochaine sortie.</p>
          <Link to="/events" className={linkButton()}>
            Voir les événements
          </Link>
        </StatusMessage>
      ) : (
        <>
          <RegistrationGroup title="À venir" registrations={upcoming} onCancel={ask} />
          <WaitlistGroup
            entries={waiting}
            leavingId={leaveWaitlist.isPending ? leaveWaitlist.variables : undefined}
            onLeave={(entry) => {
              leaveWaitlist.reset();
              setNotice(null);
              leaveWaitlist.mutate(entry.id, {
                onSuccess: () =>
                  setNotice(`Vous avez quitté la liste d'attente de « ${entry.event.title} ».`),
              });
            }}
          />
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
    <section className={listSection} aria-label={title}>
      <h2 className={sectionTitle}>{title}</h2>
      <ul className={listRows}>
        {registrations.map((registration) => {
          const { event } = registration;
          return (
            <li key={registration.id} className={listRow}>
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
                  {event.venue} · {event.city} · {formatPrice(event.priceCents)}
                </p>
              </div>
              <div className={listRowSide}>
                {event.isCancelled ? (
                  <Chip color="danger" variant="soft" size="sm" className="font-semibold">
                    Événement annulé
                  </Chip>
                ) : (
                  <SeatsBadge
                    remainingSeats={event.remainingSeats}
                    capacity={event.capacity}
                    isFull={event.isFull}
                  />
                )}
                {event.isCancelled ? null : onCancel ? (
                  <Button
                    variant="danger-soft"
                    size="sm"
                    aria-label={`Annuler l'inscription à ${event.title}`}
                    onPress={() => onCancel(registration)}
                  >
                    Annuler
                  </Button>
                ) : (
                  <span className="text-sm text-muted">Terminé</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface WaitlistGroupProps {
  entries: UserWaitlistEntry[];
  leavingId?: string;
  onLeave: (entry: UserWaitlistEntry) => void;
}

function WaitlistGroup({ entries, leavingId, onLeave }: WaitlistGroupProps) {
  if (entries.length === 0) return null;
  return (
    <section className={listSection} aria-label="Listes d'attente">
      <h2 className={sectionTitle}>Listes d'attente</h2>
      <ul className={listRows}>
        {entries.map((entry) => {
          const { event } = entry;
          return (
            <li key={entry.id} className={listRow}>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className={listRowTitle}>
                  <Link to={`/events/${event.id}`} className="no-underline hover:underline">
                    {event.title}
                  </Link>
                </h3>
                <p className={listRowMeta}>
                  <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
                </p>
                <p className={listRowMeta}>Position {entry.position} dans la file</p>
              </div>
              <div className={listRowSide}>
                <Chip color="accent" variant="soft" size="sm" className="font-semibold">
                  En attente
                </Chip>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={leavingId === entry.id}
                  aria-label={`Quitter la liste d'attente de ${event.title}`}
                  onPress={() => onLeave(entry)}
                >
                  {leavingId === entry.id ? 'Retrait…' : 'Quitter'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
