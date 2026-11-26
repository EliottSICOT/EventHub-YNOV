import { NotFoundException } from '@nestjs/common';
import { ValidationException } from '../common/errors/validation.exception.js';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import { CATEGORY_NOT_FOUND_MESSAGE, EventsService } from './events.service.js';
import { fillRate, remainingSeats } from './events.mapper.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

describe('remainingSeats', () => {
  it('soustrait les inscriptions de la capacité', () => {
    expect(remainingSeats(100, 30)).toBe(70);
  });

  it('ne descend jamais sous zéro', () => {
    expect(remainingSeats(10, 12)).toBe(0);
  });
});

describe('fillRate', () => {
  it('calcule le pourcentage entier d’inscrits', () => {
    expect(fillRate(300, 42)).toBe(14);
  });

  it('plafonne à 100 %', () => {
    expect(fillRate(10, 12)).toBe(100);
  });
});

describe('EventsService', () => {
  const prismaMock = {
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    $queryRaw: vi.fn(),
    event: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn() },
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
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 25 }]);
    prismaMock.event.findMany.mockResolvedValue([]);

    const result = await service.findAll({ page: 3, pageSize: 10 }, NOW);

    expect(result).toEqual({
      data: [],
      meta: { page: 3, pageSize: 10, total: 25, totalPages: 3 },
    });
  });

  it("garde l'ordre du tri, quel que soit celui de la base", async () => {
    const event = (id: string) => ({
      id,
      startsAt: NOW,
      endsAt: null,
      capacity: 1,
      _count: { registrations: 0 },
    });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'b' }, { id: 'c' }, { id: 'a' }])
      .mockResolvedValueOnce([{ total: 3 }]);
    prismaMock.event.findMany.mockResolvedValue([event('a'), event('b'), event('c')]);

    const { data } = await service.findAll({ page: 1, pageSize: 10 }, NOW);
    expect(data.map((e) => e.id)).toEqual(['b', 'c', 'a']);
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

  it('liste les événements de l’organisateur avec le taux de remplissage (US12)', async () => {
    prismaMock.event.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Nuit du jazz',
        startsAt: new Date('2026-12-05T18:00:00.000Z'),
        capacity: 300,
        cancelledAt: null,
        _count: { registrations: 42 },
      },
    ]);

    await expect(service.listForOrganizer('orga')).resolves.toEqual([
      {
        id: 'e1',
        title: 'Nuit du jazz',
        startsAt: '2026-12-05T18:00:00.000Z',
        capacity: 300,
        registeredCount: 42,
        fillRate: 14,
        isCancelled: false,
      },
    ]);
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizerId: 'orga' } }),
    );
  });

  describe('create (US08)', () => {
    const input = {
      title: 'Nuit du jazz',
      description: 'Trois quartets sur scène.',
      categoryId: 'c1',
      startsAt: '2026-12-05T18:00:00.000Z',
      venue: 'Le Transbordeur',
      city: 'Lyon',
      capacity: 300,
      priceCents: 0,
    } satisfies CreateEventDto;
    const created = {
      ...input,
      id: 'e1',
      startsAt: new Date(input.startsAt),
      endsAt: null,
      address: null,
      imageUrl: null,
      category: { id: 'c1', name: 'Concert', slug: 'concert' },
      organizer: { id: 'orga', firstName: 'Camille', lastName: 'Martin' },
      _count: { registrations: 0 },
    };

    it("crée l'événement au nom de l'organisateur connecté", async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'c1' });
      prismaMock.event.create.mockResolvedValue(created);

      const event = await service.create(input, 'orga');

      expect(prismaMock.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Nuit du jazz',
            startsAt: new Date('2026-12-05T18:00:00.000Z'),
            endsAt: null,
            address: null,
            priceCents: 0,
            categoryId: 'c1',
            organizerId: 'orga',
          }),
        }),
      );
      expect(event).toMatchObject({
        id: 'e1',
        remainingSeats: 300,
        isFull: false,
        organizer: { id: 'orga', name: 'Camille Martin' },
      });
    });

    it('convertit la date de fin et garde l’adresse', async () => {
      prismaMock.category.findUnique.mockResolvedValue({ id: 'c1' });
      prismaMock.event.create.mockResolvedValue(created);

      await service.create(
        { ...input, endsAt: '2026-12-05T21:00:00.000Z', address: '3 bd Stalingrad' },
        'orga',
      );

      expect(prismaMock.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endsAt: new Date('2026-12-05T21:00:00.000Z'),
            address: '3 bd Stalingrad',
          }),
        }),
      );
    });

    it('refuse une catégorie inconnue avec une 400 sur le champ categoryId', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      const attempt = service.create(input, 'orga');
      await expect(attempt).rejects.toBeInstanceOf(ValidationException);
      await expect(attempt).rejects.toMatchObject({
        details: [{ field: 'categoryId', message: CATEGORY_NOT_FOUND_MESSAGE }],
      });
      expect(prismaMock.event.create).not.toHaveBeenCalled();
    });
  });
});
