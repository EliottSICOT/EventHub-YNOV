import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useEvent } from '../../api/queries';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { RegisterButton } from '../registrations/RegisterButton';
import { formatDateTime, formatPrice } from './format';
import { SeatsBadge } from './SeatsBadge';

/** Écran « Détail d'un événement » (US03). */
export function EventDetailPage() {
  const { id = '' } = useParams();
  const { data: event, isPending, isError, error, refetch } = useEvent(id);

  const back = (
    <Link to="/events" className="back-link">
      ← Retour aux événements
    </Link>
  );

  if (isPending) return <Spinner label="Chargement de l'événement…" />;

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <section className="page">
        {back}
        {notFound ? (
          <StatusMessage variant="error" title="Événement introuvable">
            <p>Cet événement n'existe pas ou a été supprimé.</p>
          </StatusMessage>
        ) : (
          <StatusMessage variant="error" title="Impossible de charger l'événement">
            <button type="button" className="button" onClick={() => void refetch()}>
              Réessayer
            </button>
          </StatusMessage>
        )}
      </section>
    );
  }

  return (
    <article className="page detail">
      {back}
      {event.imageUrl ? (
        <img className="detail__image" src={event.imageUrl} alt={`Visuel de ${event.title}`} />
      ) : (
        <div className="detail__image detail__image--placeholder" aria-hidden="true">
          {event.category.name}
        </div>
      )}

      <header className="detail__header">
        <span className="card__category">{event.category.name}</span>
        <h1>{event.title}</h1>
      </header>

      <dl className="detail__facts">
        <div>
          <dt>Date</dt>
          <dd>
            <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Lieu</dt>
          <dd>
            {event.venue}
            {event.address && <>, {event.address}</>} · {event.city}
          </dd>
        </div>
        <div>
          <dt>Prix</dt>
          <dd>{formatPrice(event.priceCents)}</dd>
        </div>
        <div>
          <dt>Organisateur</dt>
          <dd>{event.organizer.name}</dd>
        </div>
        <div>
          <dt>Places</dt>
          <dd className="detail__seats">
            <SeatsBadge
              remainingSeats={event.remainingSeats}
              capacity={event.capacity}
              isFull={event.isFull}
            />
            <span className="muted">sur {event.capacity}</span>
          </dd>
        </div>
      </dl>

      <section className="detail__description">
        <h2>Description</h2>
        <p>{event.description}</p>
      </section>

      <div className="detail__actions">
        <RegisterButton event={event} />
      </div>
    </article>
  );
}
