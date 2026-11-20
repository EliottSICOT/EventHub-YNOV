import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_MESSAGES, SESSION_TTL_MS } from './auth.constants.js';
import { AuthService, hashSessionToken } from './auth.service.js';

const PASSWORD = 'motdepasse-solide';

const publicUser = {
  id: 'u1',
  email: 'lea@example.com',
  firstName: 'Léa',
  lastName: 'Dupont',
  role: 'PARTICIPANT' as const,
};

describe('AuthService', () => {
  const prismaMock = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  };
  let service: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('signUp', () => {
    const input = {
      firstName: ' Léa ',
      lastName: 'Dupont',
      email: '  Lea@Example.COM ',
      password: PASSWORD,
    };

    it('crée un participant avec un mot de passe haché et un email normalisé', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(publicUser);

      const user = await service.signUp(input);

      expect(user).toEqual(publicUser);
      const { data, select } = prismaMock.user.create.mock.calls[0][0];
      expect(data).toMatchObject({
        email: 'lea@example.com',
        firstName: 'Léa',
        role: 'PARTICIPANT',
      });
      expect(data.passwordHash).not.toBe(PASSWORD);
      expect(data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await argon2.verify(data.passwordHash, PASSWORD)).toBe(true);
      expect(select).not.toHaveProperty('passwordHash');
    });

    it('refuse un email déjà utilisé (409)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u0' });

      await expect(service.signUp(input)).rejects.toThrow(
        new ConflictException(AUTH_MESSAGES.emailTaken),
      );
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'lea@example.com' } }),
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('convertit une violation de la contrainte unique en 409', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.signUp(input)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('signIn', () => {
    it('ouvre une session de 7 jours et ne renvoie pas le hash', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...publicUser, passwordHash });
      const before = Date.now();

      const session = await service.signIn({ email: ' LEA@example.com', password: PASSWORD });

      expect(session.user).toEqual(publicUser);
      expect(session.user).not.toHaveProperty('passwordHash');
      expect(session.token).toMatch(/^[\w-]{43}$/);
      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + SESSION_TTL_MS);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'lea@example.com' } }),
      );
      // Seule l'empreinte du jeton est stockée.
      expect(prismaMock.session.create).toHaveBeenCalledWith({
        data: {
          tokenHash: hashSessionToken(session.token),
          userId: 'u1',
          expiresAt: session.expiresAt,
        },
      });
    });

    it('renvoie le même 401 générique pour un mauvais mot de passe…', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...publicUser, passwordHash });

      await expect(
        service.signIn({ email: 'lea@example.com', password: 'mauvais-mdp' }),
      ).rejects.toThrow(new UnauthorizedException(AUTH_MESSAGES.invalidCredentials));
      expect(prismaMock.session.create).not.toHaveBeenCalled();
    });

    it('…et pour un email inconnu', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.signIn({ email: 'inconnu@example.com', password: PASSWORD }),
      ).rejects.toThrow(new UnauthorizedException(AUTH_MESSAGES.invalidCredentials));
      expect(prismaMock.session.create).not.toHaveBeenCalled();
    });

    it('refuse un compte dont le hash est illisible', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...publicUser, passwordHash: 'not-a-hash' });

      await expect(
        service.signIn({ email: 'lea@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signOut', () => {
    it('supprime la session correspondant au jeton', async () => {
      await service.signOut('jeton');

      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: hashSessionToken('jeton') },
      });
    });

    it('ne fait rien sans jeton', async () => {
      await service.signOut(undefined);

      expect(prismaMock.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('findUserBySession', () => {
    it("renvoie l'utilisateur d'une session valide", async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 's1',
        expiresAt: new Date(Date.now() + 60_000),
        user: publicUser,
      });

      await expect(service.findUserBySession('jeton')).resolves.toEqual(publicUser);
      expect(prismaMock.session.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: hashSessionToken('jeton') } }),
      );
    });

    it('renvoie null pour un jeton inconnu', async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(service.findUserBySession('jeton')).resolves.toBeNull();
    });

    it('supprime une session expirée et renvoie null', async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 's1',
        expiresAt: new Date(Date.now() - 1),
        user: publicUser,
      });

      await expect(service.findUserBySession('jeton')).resolves.toBeNull();
      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { id: 's1' } });
    });
  });
});
