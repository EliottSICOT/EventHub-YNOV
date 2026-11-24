import { Link } from 'react-router';
import type { MyRegistration } from '../../api/types';
import { formatDateTime } from '../events/format';

/** Une inscription dans « Mes inscriptions » : toute la carte ouvre le détail de l'événement. */
export function RegistrationCard({ registration }: { registration: MyRegistration }) {
  const { event } = registration;
  return (
    <article className="card">
      <span className="card__category">{event.category.name}</span>
      <h3 className="card__title">
        <Link to={`/events/${event.id}`} className="card__link">
          {event.title}
        </Link>
      </h3>
      <p className="card__meta">
        <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
      </p>
      <p className="card__meta">
        {event.venue} · {event.city}
      </p>
    </article>
  );
}
