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
type EventWithRegistrationCount = Prisma.EventGetPayload<{
  include: { _count: { select: { registrations: true } } };
}>;

export function remainingSeats(capacity: number, registrations: number): number {
  return Math.max(0, capacity - registrations);
}

/** Taux de remplissage en pourcentage entier (0–100). */
export function fillRate(registeredCount: number, capacity: number): number {
  return Math.round((registeredCount / capacity) * 100);
}

export function toOrganizerEvent(event: EventWithRegistrationCount): OrganizerEventDto {
  const registeredCount = event._count.registrations;
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    capacity: event.capacity,
    registeredCount,
    fillRate: fillRate(registeredCount, event.capacity),
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
