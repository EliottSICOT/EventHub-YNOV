import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
}

/** Traduit les filtres du catalogue en clause Prisma. */
export function buildEventsWhere(
  query: Pick<ListEventsQueryDto, 'from' | 'to' | 'category' | 'city'>,
  now: Date,
): Prisma.EventWhereInput {
  const startsAt: Prisma.DateTimeFilter = {
    gte: query.from ? new Date(query.from) : now,
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
