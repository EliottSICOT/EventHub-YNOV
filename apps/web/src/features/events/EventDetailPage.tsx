import { Button, Card } from '@heroui/react';
import { Link, useLocation, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useEvent } from '../../api/queries';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Notice } from '../../components/Notice';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { pageTitle, sectionTitle, textLink } from '../../components/ui';
import type { CreatedEventState } from '../organizer/CreateEventPage';
import type { UpdatedEventState } from '../organizer/EditEventPage';
import { EventActions } from '../organizer/EventActions';
import { RegisterButton } from '../registrations/RegisterButton';
import { formatDateTime, formatPrice } from './format';
import { SeatsBadge } from './SeatsBadge';

/** Écran « Détail d'un événement » (US03). */
export function EventDetailPage() {
  const { id = '' } = useParams();
  const { data: event, isPending, isError, error, refetch } = useEvent(id);
  // Arrivée depuis le formulaire de création (US08) ou de modification (US09).
  const saved = useLocation().state as CreatedEventState | UpdatedEventState | null;
  const isNew = saved !== null && 'created' in saved;
  useDocumentTitle(event?.title ?? (isError ? 'Événement introuvable' : undefined));

  const back = (
    <Link to="/events" className={`${textLink} inline-flex w-fit text-sm`}>
      ← Retour aux événements
    </Link>
  );

  if (isPending) return <Spinner label="Chargement de l'événement…" />;

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <section className="flex flex-col gap-4">
        {back}
        {notFound ? (
          <StatusMessage variant="error" title="Événement introuvable">
            <p>Cet événement n'existe pas ou a été supprimé.</p>
          </StatusMessage>
        ) : (
          <StatusMessage variant="error" title="Impossible de charger l'événement">
            <Button onPress={() => void refetch()}>Réessayer</Button>
          </StatusMessage>
        )}
      </section>
    );
  }

  return (
    <article className="flex flex-col gap-6">
      {back}
      {saved && !event.isCancelled && (
        <Notice tone="success" role="status">
          {isNew
            ? 'Événement créé : il est maintenant visible dans le catalogue.'
            : 'Événement modifié.'}
        </Notice>
      )}
      {saved?.imageError && (
        <Notice tone="warning" role="alert">
          L'événement est bien {isNew ? 'créé' : 'modifié'}, mais l'image n'a pas été enregistrée :{' '}
          {saved.imageError}
        </Notice>
      )}
      {event.isCancelled && (
        <Notice tone="danger">
          <strong>Événement annulé</strong> par son organisateur : les inscriptions sont fermées.
        </Notice>
      )}
      <EventActions event={event} />

      {event.imageUrl ? (
        <img
          className="aspect-[3/1] w-full rounded-3xl object-cover shadow-sm"
          src={event.imageUrl}
          alt={`Visuel de ${event.title}`}
        />
      ) : (
        <div
          className="gradient-banner grid aspect-[4/1] w-full place-items-center rounded-3xl text-2xl font-extrabold tracking-tight shadow-xl sm:text-4xl"
          aria-hidden="true"
        >
          {event.category.name}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wider text-accent-soft-foreground uppercase">
              {event.category.name}
            </span>
            <h1 className={pageTitle}>{event.title}</h1>
          </header>

          <section className="flex flex-col gap-2">
            <h2 className={sectionTitle}>Description</h2>
            <p className="leading-relaxed whitespace-pre-line text-foreground">
              {event.description}
            </p>
          </section>
        </div>

        <Card className="h-fit gap-5 rounded-3xl p-6 lg:sticky lg:top-24">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="font-semibold text-muted">Date</dt>
              <dd className="mt-0.5 text-base text-foreground">
                <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-muted">Lieu</dt>
              <dd className="mt-0.5 text-base text-foreground">
                {event.venue}
                {event.address && <>, {event.address}</>} · {event.city}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-muted">Prix</dt>
              <dd className="mt-0.5 text-base font-bold text-foreground">
                {formatPrice(event.priceCents)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-muted">Organisateur</dt>
              <dd className="mt-0.5 text-base text-foreground">{event.organizer.name}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted">Places</dt>
              <dd className="mt-1 flex items-center gap-2">
                <SeatsBadge
                  remainingSeats={event.remainingSeats}
                  capacity={event.capacity}
                  isFull={event.isFull}
                />
                <span className="text-muted">sur {event.capacity}</span>
              </dd>
            </div>
          </dl>
          <RegisterButton event={event} />
        </Card>
      </div>
    </article>
  );
}
