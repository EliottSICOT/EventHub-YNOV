import type { Prisma } from '../generated/prisma/client.js';
import type { EventDetailDto } from './dto/event-detail.dto.js';
import type { EventSummaryDto } from './dto/event-summary.dto.js';
import type { OrganizerEventDto } from './dto/organizer-event.dto.js';

export const eventSummaryInclude = {
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { registrations: true } },
} satisfies Prisma.EventInclude;

export const eventDetailInclude = {
  ...eventSummaryInclude,
  organizer: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EventInclude;

type EventWithSummary = Prisma.EventGetPayload<{
  include: typeof eventSummaryInclude;
}>;
type EventWithDetail = Prisma.EventGetPayload<{
  include: typeof eventDetailInclude;
}>;

export function remainingSeats(capacity: number, registrations: number): number {
  return Math.max(0, capacity - registrations);
}

/** Taux de remplissage entier 0–100 (US12). Capacité ≥ 1 en base. */
export function fillRate(capacity: number, registrations: number): number {
  return Math.min(100, Math.round((registrations / capacity) * 100));
}

export function toOrganizerEvent(event: {
  id: string;
  title: string;
  startsAt: Date;
  capacity: number;
  cancelledAt: Date | null;
  _count: { registrations: number };
}): OrganizerEventDto {
  const registeredCount = event._count.registrations;
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    capacity: event.capacity,
    registeredCount,
    fillRate: fillRate(event.capacity, registeredCount),
    isCancelled: Boolean(event.cancelledAt),
  };
}

export function toEventSummary(event: EventWithSummary): EventSummaryDto {
  const remaining = remainingSeats(event.capacity, event._count.registrations);
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    venue: event.venue,
    city: event.city,
    capacity: event.capacity,
    priceCents: event.priceCents,
    remainingSeats: remaining,
    isFull: remaining === 0,
    isCancelled: Boolean(event.cancelledAt),
    imageUrl: event.imageUrl,
    category: event.category,
  };
}

export function toEventDetail(event: EventWithDetail): EventDetailDto {
  return Object.assign(toEventSummary(event), {
    description: event.description,
    address: event.address,
    organizer: {
      id: event.organizer.id,
      name: `${event.organizer.firstName} ${event.organizer.lastName}`,
    },
  });
}
