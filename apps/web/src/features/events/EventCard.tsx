import { Card } from '@heroui/react';
import { Link } from 'react-router';
import type { EventSummary } from '../../api/types';
import { formatPrice, formatShortDate } from './format';
import { SeatsBadge } from './SeatsBadge';

export function EventCard({ event }: { event: EventSummary }) {
  return (
    <article className="h-full">
      <Card className="relative h-full gap-3 rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-1 focus-within:-translate-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-accent-soft-foreground uppercase">
            {event.category.name}
          </span>
          <SeatsBadge
            remainingSeats={event.remainingSeats}
            capacity={event.capacity}
            isFull={event.isFull}
          />
        </div>
        {/* Toute la carte est cliquable via le lien du titre (`stretched-link`). */}
        <h2 className="text-lg leading-snug font-bold text-foreground">
          <Link to={`/events/${event.id}`} className="stretched-link no-underline hover:underline">
            {event.title}
          </Link>
        </h2>
        <div className="space-y-1 text-sm text-muted">
          <p>
            <time dateTime={event.startsAt}>{formatShortDate(event.startsAt)}</time>
          </p>
          <p>
            {event.venue} · {event.city}
          </p>
        </div>
        <p className="mt-auto pt-2 text-base font-bold text-foreground">
          {formatPrice(event.priceCents)}
        </p>
      </Card>
    </article>
  );
}
