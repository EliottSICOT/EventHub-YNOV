import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REGISTRATION_MESSAGES } from './registrations.constants.js';
import { RegistrationsService } from './registrations.service.js';

describe('RegistrationsService', () => {
  const prismaMock = { $transaction: vi.fn() };
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
});
