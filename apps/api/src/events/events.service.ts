import { Injectable, NotFoundException } from '@nestjs/common';
import { ValidationException } from '../common/errors/validation.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { EventDetailDto } from './dto/event-detail.dto.js';
import type { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import type { PaginatedEventsDto } from './dto/paginated-events.dto.js';
import {
  eventDetailInclude,
  eventSummaryInclude,
  toEventDetail,
  toEventSummary,
} from './events.mapper.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const EVENT_NOT_FOUND_MESSAGE = "L'événement demandé n'existe pas";
export const CATEGORY_NOT_FOUND_MESSAGE = "La catégorie choisie n'existe pas";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListEventsQueryDto, now: Date = new Date()): Promise<PaginatedEventsDto> {
    const { page, pageSize } = query;
    const where = buildEventsWhere(query, now);

    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: eventSummaryInclude,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events.map(toEventSummary),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
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

  /** Crée un événement (US08) au nom de `organizerId`, l'utilisateur connecté. */
  async create(input: CreateEventDto, organizerId: string): Promise<EventDetailDto> {
    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new ValidationException([{ field: 'categoryId', message: CATEGORY_NOT_FOUND_MESSAGE }]);
    }

    const event = await this.prisma.event.create({
      data: {
        title: input.title,
        description: input.description,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        venue: input.venue,
        address: input.address ?? null,
        city: input.city,
        capacity: input.capacity,
        priceCents: input.priceCents,
        categoryId: category.id,
        organizerId,
      },
      include: eventDetailInclude,
    });
    return toEventDetail(event);
  }
}

/** Traduit les filtres du catalogue en clause Prisma. */
export function buildEventsWhere(
  query: Pick<ListEventsQueryDto, 'from' | 'to' | 'category' | 'city'>,
  now: Date,
): Prisma.EventWhereInput {
  // Le catalogue n'affiche jamais d'événement passé : un `from` antérieur à maintenant est ignoré.
  const from = query.from ? new Date(query.from) : now;
  const startsAt: Prisma.DateTimeFilter = {
    gte: from.getTime() > now.getTime() ? from : now,
  };
  if (query.to) {
    if (DATE_ONLY.test(query.to)) {
      // Une date seule (YYYY-MM-DD) inclut toute la journée.
      startsAt.lt = new Date(new Date(query.to).getTime() + ONE_DAY_MS);
    } else {
      startsAt.lte = new Date(query.to);
    }
  }

  return {
    startsAt,
    ...(query.category && { category: { slug: query.category } }),
    ...(query.city && {
      city: { contains: query.city, mode: 'insensitive' as const },
    }),
  };
}
