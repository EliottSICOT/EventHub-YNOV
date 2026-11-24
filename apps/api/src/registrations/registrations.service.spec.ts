import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REGISTRATION_MESSAGES } from './registrations.constants.js';
import { RegistrationsService } from './registrations.service.js';

describe('RegistrationsService', () => {
  const prismaMock = { $transaction: vi.fn(), registration: { findMany: vi.fn() } };
  let service: RegistrationsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [RegistrationsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(RegistrationsService);
  });

  it("traduit une violation de la contrainte d'unicité en 409", async () => {
    prismaMock.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const attempt = service.register('event-1', 'user-1');
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      message: REGISTRATION_MESSAGES.alreadyRegistered,
    });
  });

  it("classe un événement qui commence à l'instant dans les inscriptions passées", async () => {
    const now = new Date('2026-12-01T18:00:00.000Z');
    const registrationAt = (id: string, startsAt: Date) => ({
      id,
      createdAt: new Date('2026-11-20T10:00:00.000Z'),
      event: {
        id: `event-${id}`,
        title: id,
        startsAt,
        endsAt: null,
        venue: 'Salle',
        city: 'Lyon',
        capacity: 10,
        priceCents: 0,
        imageUrl: null,
        category: { id: 'c', name: 'Concert', slug: 'concert' },
        _count: { registrations: 1 },
      },
    });
    prismaMock.registration.findMany.mockResolvedValue([
      registrationAt('commence', now),
      registrationAt('bientot', new Date(now.getTime() + 1)),
    ]);

    const result = await service.findByUser('user-1', now);
    expect(result.past.map((r) => r.id)).toEqual(['commence']);
    expect(result.upcoming.map((r) => r.id)).toEqual(['bientot']);
  });

  it('laisse remonter les autres erreurs', async () => {
    const failure = new Error('connexion perdue');
    prismaMock.$transaction.mockRejectedValue(failure);
    await expect(service.register('event-1', 'user-1')).rejects.toBe(failure);
  });
});
