import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REGISTRATION_MESSAGES } from '../src/registrations/registrations.constants.js';
import { assertTestDatabase } from './test-database.js';

const PASSWORD = 'motdepasse-solide';

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe('Inscription à un événement (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryId: string;
  let organizerId: string;

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL!);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.registration.deleteMany();
    await prisma.event.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();

    categoryId = (await prisma.category.create({ data: { name: 'Concert', slug: 'concert' } })).id;
    organizerId = (
      await prisma.user.create({
        data: {
          email: 'orga@test.dev',
          passwordHash: 'x',
          firstName: 'Camille',
          lastName: 'Martin',
          role: 'ORGANIZER',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function createEvent(capacity: number, startsAt = inDays(5)) {
    const event = await prisma.event.create({
      data: {
        title: `Événement ${capacity} places`,
        description: 'Description',
        startsAt,
        venue: 'Salle',
        city: 'Lyon',
        capacity,
        categoryId,
        organizerId,
      },
    });
    return event.id;
  }

  let accountCount = 0;
  /** Crée un participant et renvoie son cookie de session. */
  async function newParticipant() {
    const email = `participant${++accountCount}@test.dev`;
    await http()
      .post('/api/v1/auth/sign-up')
      .send({ firstName: 'Léa', lastName: 'Dupont', email, password: PASSWORD })
      .expect(201);
    const res = await http().post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
    const header = res.headers['set-cookie'] as unknown as string[];
    return header.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0];
  }

  const register = (eventId: string, cookie?: string) => {
    const req = http().post(`/api/v1/events/${eventId}/registrations`);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  describe('POST /api/v1/events/:id/registrations', () => {
    it("inscrit l'utilisateur connecté et renvoie les places restantes à jour", async () => {
      const eventId = await createEvent(3);
      const cookie = await newParticipant();

      const res = await register(eventId, cookie).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        eventId,
        createdAt: expect.any(String),
        remainingSeats: 2,
        isFull: false,
      });
      expect(await prisma.registration.count({ where: { eventId } })).toBe(1);

      const detail = await http().get(`/api/v1/events/${eventId}`).expect(200);
      expect(detail.body).toMatchObject({ remainingSeats: 2, isFull: false });
    });

    it('signale isFull quand la dernière place est prise', async () => {
      const eventId = await createEvent(1);
      const res = await register(eventId, await newParticipant()).expect(201);
      expect(res.body).toMatchObject({ remainingSeats: 0, isFull: true });
    });

    it('renvoie 401 sans session', async () => {
      const eventId = await createEvent(3);
      const res = await register(eventId).expect(401);
      expect(res.body.message).toBe('Authentification requise');
      expect(await prisma.registration.count({ where: { eventId } })).toBe(0);
    });

    it('renvoie 404 pour un événement inconnu', async () => {
      const res = await register('inconnu', await newParticipant()).expect(404);
      expect(res.body.message).toBe("L'événement demandé n'existe pas");
    });

    it('renvoie 409 à la seconde inscription au même événement', async () => {
      const eventId = await createEvent(5);
      const cookie = await newParticipant();
      await register(eventId, cookie).expect(201);

      const res = await register(eventId, cookie).expect(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        message: REGISTRATION_MESSAGES.alreadyRegistered,
      });
      expect(await prisma.registration.count({ where: { eventId } })).toBe(1);
    });

    it('renvoie 409 pour un événement complet', async () => {
      const eventId = await createEvent(1);
      await register(eventId, await newParticipant()).expect(201);

      const res = await register(eventId, await newParticipant()).expect(409);
      expect(res.body.message).toBe(REGISTRATION_MESSAGES.eventFull);
      expect(await prisma.registration.count({ where: { eventId } })).toBe(1);
    });

    it('renvoie 409 pour un événement passé', async () => {
      const eventId = await createEvent(5, inDays(-1));
      const res = await register(eventId, await newParticipant()).expect(409);
      expect(res.body.message).toBe(REGISTRATION_MESSAGES.eventPast);
      expect(await prisma.registration.count({ where: { eventId } })).toBe(0);
    });

    it('ne dépasse jamais la capacité sous inscriptions simultanées', async () => {
      const capacity = 3;
      const eventId = await createEvent(capacity);
      const cookies = await Promise.all(Array.from({ length: 10 }, () => newParticipant()));

      const responses = await Promise.all(cookies.map((cookie) => register(eventId, cookie)));

      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(capacity);
      expect(statuses.filter((s) => s === 409)).toHaveLength(cookies.length - capacity);
      expect(await prisma.registration.count({ where: { eventId } })).toBe(capacity);

      const remaining = responses
        .filter((r) => r.status === 201)
        .map((r) => r.body.remainingSeats as number)
        .sort((a, b) => a - b);
      expect(remaining).toEqual([0, 1, 2]);
    });

    it('ne crée qu’une inscription quand le même utilisateur clique en double simultanément', async () => {
      const eventId = await createEvent(10);
      const cookie = await newParticipant();

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => register(eventId, cookie)),
      );

      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(responses.filter((r) => r.status === 409)).toHaveLength(4);
      expect(await prisma.registration.count({ where: { eventId } })).toBe(1);
    });
  });

  describe('GET /api/v1/me/registrations', () => {
    const mine = (cookie?: string) => {
      const req = http().get('/api/v1/me/registrations');
      return cookie ? req.set('Cookie', cookie) : req;
    };
    const titles = (registrations: { event: { title: string } }[]) =>
      registrations.map((r) => r.event.title);

    /** Inscription écrite en base : l'API refuse de s'inscrire à un événement passé. */
    async function registerInPast(cookie: string, eventId: string) {
      const me = await http().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
      await prisma.registration.create({ data: { eventId, userId: me.body.id } });
    }

    async function createTitledEvent(title: string, startsAt: Date) {
      const id = await createEvent(10, startsAt);
      await prisma.event.update({ where: { id }, data: { title } });
      return id;
    }

    it('renvoie 401 sans session', async () => {
      const res = await mine().expect(401);
      expect(res.body.message).toBe('Authentification requise');
    });

    it('renvoie deux listes vides sans inscription', async () => {
      const res = await mine(await newParticipant()).expect(200);
      expect(res.body).toEqual({ upcoming: [], past: [] });
    });

    it("renvoie l'inscription avec le titre, la date et le lieu de l'événement", async () => {
      const startsAt = inDays(5);
      const eventId = await createTitledEvent('Nuit du jazz', startsAt);
      const cookie = await newParticipant();
      const created = await register(eventId, cookie).expect(201);

      const res = await mine(cookie).expect(200);
      expect(res.body).toEqual({
        upcoming: [
          {
            id: created.body.id,
            createdAt: created.body.createdAt,
            event: expect.objectContaining({
              id: eventId,
              title: 'Nuit du jazz',
              startsAt: startsAt.toISOString(),
              venue: 'Salle',
              city: 'Lyon',
              remainingSeats: 9,
            }),
          },
        ],
        past: [],
      });
    });

    it('sépare et trie les inscriptions à venir et passées', async () => {
      const cookie = await newParticipant();
      await register(await createTitledEvent('Dans 20 jours', inDays(20)), cookie).expect(201);
      await register(await createTitledEvent('Dans 2 jours', inDays(2)), cookie).expect(201);
      await registerInPast(cookie, await createTitledEvent('Il y a 30 jours', inDays(-30)));
      await registerInPast(cookie, await createTitledEvent('Hier', inDays(-1)));

      const res = await mine(cookie).expect(200);
      expect(titles(res.body.upcoming)).toEqual(['Dans 2 jours', 'Dans 20 jours']);
      expect(titles(res.body.past)).toEqual(['Hier', 'Il y a 30 jours']);
    });

    it("ne montre jamais les inscriptions d'un autre utilisateur", async () => {
      const eventId = await createEvent(5);
      await register(eventId, await newParticipant()).expect(201);

      const res = await mine(await newParticipant()).expect(200);
      expect(res.body).toEqual({ upcoming: [], past: [] });
    });
  });

  describe('contrainte d’unicité en base', () => {
    it('refuse deux inscriptions (événement, utilisateur) identiques', async () => {
      const eventId = await createEvent(5);
      const user = await prisma.user.create({
        data: { email: 'unique@test.dev', passwordHash: 'x', firstName: 'A', lastName: 'B' },
      });
      await prisma.registration.create({ data: { eventId, userId: user.id } });
      await expect(
        prisma.registration.create({ data: { eventId, userId: user.id } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });
});
