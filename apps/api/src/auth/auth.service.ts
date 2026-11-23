import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_MESSAGES, SESSION_TTL_MS } from './auth.constants.js';
import type { SignInDto } from './dto/sign-in.dto.js';
import type { SignUpDto } from './dto/sign-up.dto.js';
import type { UserDto } from './dto/user.dto.js';
import { normalizeEmail } from './email.js';

/** Champs exposés : le hash du mot de passe n'est jamais sélectionné. */
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
} as const satisfies Prisma.UserSelect;

export interface OpenedSession {
  user: UserDto;
  /** Jeton brut, à placer dans le cookie : il n'est stocké nulle part ailleurs. */
  token: string;
  expiresAt: Date;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  /** Hash de référence pour vérifier un mot de passe même quand l'email est inconnu (temps de réponse constant). */
  private dummyHash?: Promise<string>;

  constructor(private readonly prisma: PrismaService) {}

  async signUp(input: SignUpDto): Promise<UserDto> {
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException(AUTH_MESSAGES.emailTaken);
    }

    const passwordHash = await argon2.hash(input.password);
    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          role: Role.PARTICIPANT,
        },
        select: USER_SELECT,
      });
    } catch (error) {
      // Deux inscriptions simultanées avec le même email : la contrainte unique tranche.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(AUTH_MESSAGES.emailTaken);
      }
      throw error;
    }
  }

  async signIn(input: SignInDto): Promise<OpenedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) },
      select: { ...USER_SELECT, passwordHash: true },
    });

    const valid = user
      ? await this.verifyPassword(user.passwordHash, input.password)
      : await this.verifyPassword(await this.getDummyHash(), input.password).then(() => false);
    if (!user || !valid) {
      throw new UnauthorizedException(AUTH_MESSAGES.invalidCredentials);
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.session.deleteMany({
      where: { userId: user.id, expiresAt: { lte: new Date() } },
    });
    await this.prisma.session.create({
      data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt },
    });

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { user: publicUser, token, expiresAt };
  }

  /** Supprime la session en base. Sans jeton ou avec un jeton inconnu, ne fait rien. */
  async signOut(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  /** Utilisateur de la session portée par `token`, ou `null` si elle n'existe pas ou a expiré. */
  async findUserBySession(token: string): Promise<UserDto | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: { id: true, expiresAt: true, user: { select: USER_SELECT } },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    return session.user;
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // Hash illisible (compte créé hors de l'API) : on refuse sans divulguer pourquoi.
      return false;
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
