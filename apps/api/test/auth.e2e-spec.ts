import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertTestDatabase } from './test-database.js';

const PASSWORD = 'motdepasse-solide';
const GENERIC_401 = 'Email ou mot de passe incorrect';

const newAccount = {
  firstName: 'Léa',
  lastName: 'Dupont',
  email: 'lea.dupont@example.com',
  password: PASSWORD,
};

/** Extrait la valeur du cookie de session d'une réponse. */
function sessionCookieOf(res: request.Response): string | undefined {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

describe('Authentification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL!);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.registration.deleteMany();
    await prisma.event.deleteMany();
    await prisma.user.deleteMany(); // supprime aussi les sessions (cascade)
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function signIn(email = newAccount.email, password = PASSWORD) {
    const res = await http().post('/api/v1/auth/sign-in').send({ email, password }).expect(200);
    return sessionCookieOf(res)!.split(';')[0];
  }

  describe('POST /api/v1/auth/sign-up', () => {
    it('crée un compte participant sans renvoyer le mot de passe et stocke un hash', async () => {
      const res = await http()
        .post('/api/v1/auth/sign-up')
        .send({ ...newAccount, email: '  Lea.Dupont@Example.COM ' })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'lea.dupont@example.com',
        firstName: 'Léa',
        lastName: 'Dupont',
        role: 'PARTICIPANT',
      });
      expect(sessionCookieOf(res)).toBeUndefined();

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
      expect(stored.passwordHash).not.toContain(PASSWORD);
    });

    it('renvoie 409 si l’email est déjà pris, quelle que soit la casse', async () => {
      const res = await http()
        .post('/api/v1/auth/sign-up')
        .send({ ...newAccount, email: 'LEA.DUPONT@example.com' })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        message: 'Un compte existe déjà avec cet email',
        path: '/api/v1/auth/sign-up',
      });
    });

    it('renvoie 400 avec details pour un mot de passe de moins de 8 caractères', async () => {
      const res = await http()
        .post('/api/v1/auth/sign-up')
        .send({ ...newAccount, email: 'court@example.com', password: '1234567' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'La requête contient des champs invalides',
        details: [
          { field: 'password', message: 'Le mot de passe doit contenir au moins 8 caractères' },
        ],
      });
      expect(await prisma.user.count({ where: { email: 'court@example.com' } })).toBe(0);
    });

    it('renvoie 400 avec details pour des champs manquants ou invalides', async () => {
      const res = await http()
        .post('/api/v1/auth/sign-up')
        .send({ email: 'pas-un-email', password: PASSWORD })
        .expect(400);

      const fields = res.body.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['firstName', 'lastName', 'email']));
    });

    it('refuse de choisir son rôle à l’inscription', async () => {
      const res = await http()
        .post('/api/v1/auth/sign-up')
        .send({ ...newAccount, email: 'orga@example.com', role: 'ORGANIZER' })
        .expect(400);

      expect(res.body.details).toEqual([{ field: 'role', message: expect.any(String) }]);
    });
  });

  describe('POST /api/v1/auth/sign-in', () => {
    it('connecte l’utilisateur et pose un cookie HttpOnly, SameSite=Lax, valable 7 jours', async () => {
      const res = await http()
        .post('/api/v1/auth/sign-in')
        .send({ email: ' LEA.DUPONT@example.com ', password: PASSWORD })
        .expect(200);

      expect(res.body).toMatchObject({ email: 'lea.dupont@example.com', firstName: 'Léa' });
      expect(res.body).not.toHaveProperty('passwordHash');

      const cookie = sessionCookieOf(res);
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=604800');
      expect(cookie).not.toContain('Secure'); // hors production

      // La base ne garde que l'empreinte du jeton, pas le jeton lui-même.
      const token = cookie!.split(';')[0].split('=')[1];
      expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);
    });

    it.each([
      ['un mauvais mot de passe', newAccount.email, 'mauvais-mdp'],
      ['un email inconnu', 'inconnu@example.com', PASSWORD],
    ])('renvoie le même 401 générique pour %s', async (_case, email, password) => {
      const res = await http().post('/api/v1/auth/sign-in').send({ email, password }).expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: GENERIC_401,
      });
      expect(sessionCookieOf(res)).toBeUndefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('renvoie 401 sans cookie', async () => {
      const res = await http().get('/api/v1/auth/me').expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, message: 'Authentification requise' });
    });

    it('renvoie 401 avec un cookie inconnu', async () => {
      await http().get('/api/v1/auth/me').set('Cookie', `${SESSION_COOKIE}=inconnu`).expect(401);
    });

    it('renvoie l’utilisateur courant avec le cookie de session', async () => {
      const cookie = await signIn();

      const res = await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'lea.dupont@example.com',
        firstName: 'Léa',
        lastName: 'Dupont',
        role: 'PARTICIPANT',
      });
    });

    it('renvoie 401 quand la session a expiré', async () => {
      const cookie = await signIn();
      await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
    });
  });

  describe('POST /api/v1/auth/sign-out', () => {
    it('supprime la session en base, efface le cookie et invalide l’ancien cookie', async () => {
      await prisma.session.deleteMany();
      const cookie = await signIn();
      expect(await prisma.session.count()).toBe(1);

      const res = await http().post('/api/v1/auth/sign-out').set('Cookie', cookie).expect(204);

      expect(sessionCookieOf(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(await prisma.session.count()).toBe(0);
      await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
    });

    it('renvoie 204 même sans session', async () => {
      await http().post('/api/v1/auth/sign-out').expect(204);
    });
  });
});
