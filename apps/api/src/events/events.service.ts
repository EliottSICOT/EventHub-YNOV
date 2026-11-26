import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ValidationException } from '../common/errors/validation.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { EventDetailDto } from './dto/event-detail.dto.js';
import type { EventSummaryDto } from './dto/event-summary.dto.js';
import type { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import type { OrganizerEventDto } from './dto/organizer-event.dto.js';
import type { PaginatedEventsDto } from './dto/paginated-events.dto.js';
import type { UpdateEventDto } from './dto/update-event.dto.js';
import { assertEventOrganizer } from './event-ownership.js';
import { EVENT_NOT_FOUND_MESSAGE, MANAGE_EVENT_MESSAGES } from './events.constants.js';
import {
  eventDetailInclude,
  eventSummaryInclude,
  toEventDetail,
  toEventSummary,
  toOrganizerEvent,
} from './events.mapper.js';
import { catalogueCountSql, cataloguePageSql } from './events.search.js';

export { EVENT_NOT_FOUND_MESSAGE } from './events.constants.js';
export const CATEGORY_NOT_FOUND_MESSAGE = "La catégorie choisie n'existe pas";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListEventsQueryDto, now: Date = new Date()): Promise<PaginatedEventsDto> {
    const { page, pageSize } = query;
    const [ids, [{ total }]] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ id: string }[]>(cataloguePageSql(query, now)),
      this.prisma.$queryRaw<{ total: number }[]>(catalogueCountSql(query, now)),
    ]);
    const events = await this.findSummaries(ids.map(({ id }) => id));

    return {
      data: events,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /** Résumés des événements `ids`, dans cet ordre. */
  private async findSummaries(ids: string[]): Promise<EventSummaryDto[]> {
    const events = await this.prisma.event.findMany({
      where: { id: { in: ids } },
      include: eventSummaryInclude,
    });
    const byId = new Map(events.map((event) => [event.id, toEventSummary(event)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  async findOne(id: string): Promise<EventDetailDto> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventDetailInclude,
    });
    if (!event) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }
    return toEventDetail(event);
  }

  /**
   * Événements de l'organisateur `organizerId` (US12), passés compris, du plus proche au plus
   * lointain : le front sépare « à venir » et « passés ». Les annulés restent listés.
   */
  async listForOrganizer(organizerId: string): Promise<OrganizerEventDto[]> {
    const events = await this.prisma.event.findMany({
      where: { organizerId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        capacity: true,
        cancelledAt: true,
        _count: { select: { registrations: true } },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    return events.map(toOrganizerEvent);
  }

  /** Crée un événement (US08) au nom de `organizerId`, l'utilisateur connecté. */
  async create(input: CreateEventDto, organizerId: string): Promise<EventDetailDto> {
    await assertCategoryExists(this.prisma, input.categoryId);
    const event = await this.prisma.event.create({
      data: { ...toEventData(input), organizerId },
      include: eventDetailInclude,
    });
    return toEventDetail(event);
  }

  /**
   * Modifie un événement à venir de `userId` (US09). La ligne est verrouillée, comme pour une
   * inscription : personne ne peut s'inscrire entre le décompte des inscrits et la mise à jour,
   * la capacité ne passe donc jamais sous le nombre d'inscrits.
   */
  async update(
    id: string,
    input: UpdateEventDto,
    userId: string,
    now: Date = new Date(),
  ): Promise<EventDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      await lockManageableEvent(tx, id, userId, now);
      await assertCategoryExists(tx, input.categoryId);

      const registered = await tx.registration.count({ where: { eventId: id } });
      if (input.capacity < registered) {
        throw new ValidationException([
          {
            field: 'capacity',
            message: MANAGE_EVENT_MESSAGES.capacityBelowRegistrations(registered),
          },
        ]);
      }

      const event = await tx.event.update({
        where: { id },
        data: toEventData(input),
        include: eventDetailInclude,
      });
      return toEventDetail(event);
    });
  }

  /**
   * Supprime un événement à venir de `userId` (US09). La ligne et les inscriptions restent en
   * base : l'événement sort du catalogue, et les inscrits le voient « Événement annulé ».
   */
  async cancel(id: string, userId: string, now: Date = new Date()): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockManageableEvent(tx, id, userId, now);
      await tx.event.update({ where: { id }, data: { cancelledAt: now } });
    });
  }
}

/** Colonnes d'un événement à partir d'un corps déjà validé. */
function toEventData(input: CreateEventDto) {
  return {
    title: input.title,
    description: input.description,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    venue: input.venue,
    address: input.address ?? null,
    city: input.city,
    capacity: input.capacity,
    priceCents: input.priceCents,
    categoryId: input.categoryId,
  };
}

async function assertCategoryExists(db: Prisma.TransactionClient, categoryId: string) {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new ValidationException([{ field: 'categoryId', message: CATEGORY_NOT_FOUND_MESSAGE }]);
  }
}

/**
 * Verrouille l'événement jusqu'à la fin de la transaction et vérifie que `userId` peut le gérer :
 * 404 s'il n'existe pas, 403 s'il est à quelqu'un d'autre, 409 s'il est annulé ou a commencé.
 */
async function lockManageableEvent(
  tx: Prisma.TransactionClient,
  id: string,
  userId: string,
  now: Date,
) {
  const [event] = await tx.$queryRaw<
    { organizerId: string; startsAt: Date; cancelledAt: Date | null }[]
  >`SELECT organizer_id AS "organizerId", starts_at AS "startsAt", cancelled_at AS "cancelledAt"
    FROM events WHERE id = ${id} FOR UPDATE`;
  assertEventOrganizer(event, userId, MANAGE_EVENT_MESSAGES.notOrganizer);
  if (event.cancelledAt) throw new ConflictException(MANAGE_EVENT_MESSAGES.alreadyCancelled);
  if (event.startsAt <= now) throw new ConflictException(MANAGE_EVENT_MESSAGES.past);
}
