import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildEventsWhere, EventsService } from './events.service.js';
import { remainingSeats } from './events.mapper.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

describe('buildEventsWhere', () => {
  it('ne retourne que les événements à venir par défaut', () => {
    expect(buildEventsWhere({}, NOW)).toEqual({ startsAt: { gte: NOW } });
  });

  it('ramène un `from` passé à maintenant (#46)', () => {
    expect(buildEventsWhere({ from: '2020-01-01' }, NOW).startsAt).toEqual({ gte: NOW });
  });

  it('ramène à maintenant un `from` du jour même déjà écoulé', () => {
    expect(buildEventsWhere({ from: '2026-11-20' }, NOW).startsAt).toEqual({ gte: NOW });
  });

  it('conserve un `from` futur', () => {
    expect(buildEventsWhere({ from: '2026-12-01T18:00:00Z' }, NOW).startsAt).toEqual({
      gte: new Date('2026-12-01T18:00:00Z'),
    });
  });

  it('inclut toute la journée quand `to` est une date seule', () => {
    const where = buildEventsWhere({ from: '2026-12-01', to: '2026-12-31' }, NOW);
    expect(where.startsAt).toEqual({
      gte: new Date('2026-12-01T00:00:00.000Z'),
      lt: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('utilise une borne incluse quand `to` est une date-heure', () => {
    const where = buildEventsWhere({ to: '2026-12-31T12:00:00Z' }, NOW);
    expect(where.startsAt).toEqual({
      gte: NOW,
      lte: new Date('2026-12-31T12:00:00Z'),
    });
  });

  it('combine catégorie et ville', () => {
    expect(buildEventsWhere({ category: 'concert', city: 'lyon' }, NOW)).toEqual({
      startsAt: { gte: NOW },
      category: { slug: 'concert' },
      city: { contains: 'lyon', mode: 'insensitive' },
    });
  });
});

describe('remainingSeats', () => {
  it('soustrait les inscriptions de la capacité', () => {
    expect(remainingSeats(100, 30)).toBe(70);
  });

  it('ne descend jamais sous zéro', () => {
    expect(remainingSeats(10, 12)).toBe(0);
  });
});

describe('EventsService', () => {
  const prismaMock = {
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    event: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  };
  let service: EventsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  it('pagine et calcule les métadonnées', async () => {
    prismaMock.event.findMany.mockResolvedValue([]);
    prismaMock.event.count.mockResolvedValue(25);

    const result = await service.findAll({ page: 3, pageSize: 10 }, NOW);

    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
    expect(result.meta).toEqual({
      page: 3,
      pageSize: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it('lève une 404 pour un identifiant inconnu', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);
    await expect(service.findOne('inconnu')).rejects.toBeInstanceOf(NotFoundException);
  });

  it("expose l'organisateur et les places restantes dans le détail", async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'e1',
      title: 'Meetup',
      description: 'Desc',
      startsAt: NOW,
      endsAt: null,
      venue: 'Station F',
      address: null,
      city: 'Paris',
      capacity: 2,
      priceCents: 1500,
      imageUrl: null,
      category: { id: 'c1', name: 'Meetup tech', slug: 'meetup-tech' },
      organizer: { id: 'u1', firstName: 'Camille', lastName: 'Martin' },
      _count: { registrations: 2 },
    });

    const event = await service.findOne('e1');

    expect(event).toMatchObject({
      priceCents: 1500,
      remainingSeats: 0,
      isFull: true,
      organizer: { id: 'u1', name: 'Camille Martin' },
      startsAt: NOW.toISOString(),
    });
  });
});
