import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REGISTRATION_MESSAGES } from './registrations.constants.js';
import { RegistrationsService } from './registrations.service.js';

describe('RegistrationsService', () => {
  const prismaMock = {
    $transaction: vi.fn(),
    registration: { findUnique: vi.fn(), deleteMany: vi.fn() },
  };
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

  it('laisse remonter les autres erreurs', async () => {
    const failure = new Error('connexion perdue');
    prismaMock.$transaction.mockRejectedValue(failure);
    await expect(service.register('event-1', 'user-1')).rejects.toBe(failure);
  });
  describe('cancel', () => {
    const now = new Date('2026-12-01T10:00:00Z');
    const upcoming = new Date('2026-12-05T18:00:00Z');
    const past = new Date('2026-11-30T18:00:00Z');

    it("supprime l'inscription de son propriétaire", async () => {
      prismaMock.registration.findUnique.mockResolvedValue({
        userId: 'user-1',
        event: { startsAt: upcoming },
      });
      prismaMock.registration.deleteMany.mockResolvedValue({ count: 1 });

      await expect(service.cancel('reg-1', 'user-1', now)).resolves.toBeUndefined();
      expect(prismaMock.registration.deleteMany).toHaveBeenCalledWith({
        where: { id: 'reg-1', userId: 'user-1' },
      });
    });

    it('renvoie 404 pour une inscription inconnue', async () => {
      prismaMock.registration.findUnique.mockResolvedValue(null);
      await expect(service.cancel('reg-1', 'user-1', now)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("renvoie 403 pour l'inscription d'un autre, avant tout autre contrôle", async () => {
      prismaMock.registration.findUnique.mockResolvedValue({
        userId: 'user-2',
        event: { startsAt: past },
      });
      await expect(service.cancel('reg-1', 'user-1', now)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.registration.deleteMany).not.toHaveBeenCalled();
    });

    it('renvoie 409 pour un événement passé', async () => {
      prismaMock.registration.findUnique.mockResolvedValue({
        userId: 'user-1',
        event: { startsAt: past },
      });
      await expect(service.cancel('reg-1', 'user-1', now)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaMock.registration.deleteMany).not.toHaveBeenCalled();
    });

    it("renvoie 404 si l'inscription a été supprimée entre-temps", async () => {
      prismaMock.registration.findUnique.mockResolvedValue({
        userId: 'user-1',
        event: { startsAt: upcoming },
      });
      prismaMock.registration.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.cancel('reg-1', 'user-1', now)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
