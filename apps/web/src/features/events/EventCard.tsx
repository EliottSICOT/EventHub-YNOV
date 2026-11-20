import { Link } from 'react-router';
import type { EventSummary } from '../../api/types';
import { formatShortDate } from './format';
import { SeatsBadge } from './SeatsBadge';

export function EventCard({ event }: { event: EventSummary }) {
  return (
    <article className="card">
      <div className="card__top">
        <span className="card__category">{event.category.name}</span>
        <SeatsBadge
          remainingSeats={event.remainingSeats}
          capacity={event.capacity}
          isFull={event.isFull}
        />
      </div>
      <h2 className="card__title">
        <Link to={`/events/${event.id}`} className="card__link">
          {event.title}
        </Link>
      </h2>
      <p className="card__meta">
        <time dateTime={event.startsAt}>{formatShortDate(event.startsAt)}</time>
      </p>
      <p className="card__meta">
        {event.venue} · {event.city}
      </p>
    </article>
  );
}
