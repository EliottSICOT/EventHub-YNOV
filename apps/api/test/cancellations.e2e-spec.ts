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

describe('Annulation d’une inscription (e2e)', () => {
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

  async function createEvent(capacity: number, startsAt = inDays(5), title = 'Événement') {
    const event = await prisma.event.create({
      data: {
        title,
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
  /** Crée un participant ; renvoie son id et son cookie de session. */
  async function newParticipant() {
    const email = `participant${++accountCount}@test.dev`;
    const signUp = await http()
      .post('/api/v1/auth/sign-up')
      .send({ firstName: 'Léa', lastName: 'Dupont', email, password: PASSWORD })
      .expect(201);
    const res = await http().post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
    const header = res.headers['set-cookie'] as unknown as string[];
    const cookie = header.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0];
    return { id: signUp.body.id as string, cookie };
  }

  /** Inscription en base, y compris pour un événement passé (que l'API refuserait). */
  async function registerInDb(eventId: string, userId: string) {
    return (await prisma.registration.create({ data: { eventId, userId } })).id;
  }

  const cancel = (registrationId: string, cookie?: string) => {
    const req = http().delete(`/api/v1/registrations/${registrationId}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  describe('DELETE /api/v1/registrations/:id', () => {
    it('annule sa propre inscription et libère la place', async () => {
      const eventId = await createEvent(3);
      const alice = await newParticipant();
      const bob = await newParticipant();
      const registrationId = (
        await http()
          .post(`/api/v1/events/${eventId}/registrations`)
          .set('Cookie', alice.cookie)
          .expect(201)
      ).body.id as string;
      await http()
        .post(`/api/v1/events/${eventId}/registrations`)
        .set('Cookie', bob.cookie)
        .expect(201);
      expect((await http().get(`/api/v1/events/${eventId}`)).body.remainingSeats).toBe(1);

      await cancel(registrationId, alice.cookie).expect(204).expect('');

      expect(await prisma.registration.findUnique({ where: { id: registrationId } })).toBeNull();
      const detail = await http().get(`/api/v1/events/${eventId}`).expect(200);
      expect(detail.body).toMatchObject({ remainingSeats: 2, isFull: false });
    });

    it('rouvre un événement complet : on peut de nouveau s’y inscrire', async () => {
      const eventId = await createEvent(1);
      const alice = await newParticipant();
      const bob = await newParticipant();
      const registrationId = (
        await http()
          .post(`/api/v1/events/${eventId}/registrations`)
          .set('Cookie', alice.cookie)
          .expect(201)
      ).body.id as string;
      await http()
        .post(`/api/v1/events/${eventId}/registrations`)
        .set('Cookie', bob.cookie)
        .expect(409);

      await cancel(registrationId, alice.cookie).expect(204);

      await http()
        .post(`/api/v1/events/${eventId}/registrations`)
        .set('Cookie', bob.cookie)
        .expect(201);
    });

    it('permet de se réinscrire après une annulation', async () => {
      const eventId = await createEvent(2);
      const alice = await newParticipant();
      const registrationId = (
        await http()
          .post(`/api/v1/events/${eventId}/registrations`)
          .set('Cookie', alice.cookie)
          .expect(201)
      ).body.id as string;
      await cancel(registrationId, alice.cookie).expect(204);
      await http()
        .post(`/api/v1/events/${eventId}/registrations`)
        .set('Cookie', alice.cookie)
        .expect(201);
    });

    it('renvoie 401 sans session', async () => {
      const eventId = await createEvent(3);
      const alice = await newParticipant();
      const registrationId = await registerInDb(eventId, alice.id);

      const res = await cancel(registrationId).expect(401);
      expect(res.body.message).toBe('Authentification requise');
      expect(await prisma.registration.count({ where: { eventId } })).toBe(1);
    });

    it('renvoie 403 pour l’inscription d’un autre utilisateur, sans la supprimer', async () => {
      const eventId = await createEvent(3);
      const alice = await newParticipant();
      const mallory = await newParticipant();
      const registrationId = await registerInDb(eventId, alice.id);

      const res = await cancel(registrationId, mallory.cookie).expect(403);
      expect(res.body).toMatchObject({
        statusCode: 403,
        error: 'Forbidden',
        message: REGISTRATION_MESSAGES.notOwner,
      });
      expect(
        await prisma.registration.findUnique({ where: { id: registrationId } }),
      ).not.toBeNull();
    });

    it('refuse aussi à un organisateur d’annuler l’inscription d’un participant', async () => {
      const eventId = await createEvent(3);
      const alice = await newParticipant();
      const registrationId = await registerInDb(eventId, alice.id);
      const organizer = await newParticipant();
      await prisma.user.update({ where: { id: organizer.id }, data: { role: 'ORGANIZER' } });

      await cancel(registrationId, organizer.cookie).expect(403);
      expect(await prisma.registration.count({ where: { id: registrationId } })).toBe(1);
    });

    it('renvoie 404 pour une inscription inconnue', async () => {
      const alice = await newParticipant();
      const res = await cancel('inconnue', alice.cookie).expect(404);
      expect(res.body.message).toBe(REGISTRATION_MESSAGES.notFound);
    });

    it('renvoie 409 pour un événement passé, sans supprimer l’inscription', async () => {
      const eventId = await createEvent(3, inDays(-1));
      const alice = await newParticipant();
      const registrationId = await registerInDb(eventId, alice.id);

      const res = await cancel(registrationId, alice.cookie).expect(409);
      expect(res.body.message).toBe(REGISTRATION_MESSAGES.cancelPast);
      expect(
        await prisma.registration.findUnique({ where: { id: registrationId } }),
      ).not.toBeNull();
    });

    it('ne supprime qu’une fois sous annulations simultanées (double clic)', async () => {
      const eventId = await createEvent(3);
      const alice = await newParticipant();
      const registrationId = await registerInDb(eventId, alice.id);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => cancel(registrationId, alice.cookie)),
      );

      expect(responses.filter((r) => r.status === 204)).toHaveLength(1);
      expect(responses.filter((r) => r.status === 404)).toHaveLength(4);
      expect(await prisma.registration.count({ where: { eventId } })).toBe(0);
    });
  });

  describe('GET /api/v1/registrations/me', () => {
    it('liste mes inscriptions par date d’événement, passées comprises', async () => {
      const alice = await newParticipant();
      const bob = await newParticipant();
      const later = await createEvent(10, inDays(9), 'Plus tard');
      const sooner = await createEvent(10, inDays(2), 'Bientôt');
      const past = await createEvent(10, inDays(-3), 'Passé');
      const others = await createEvent(10, inDays(4), 'Celui de Bob');
      await registerInDb(later, alice.id);
      await registerInDb(sooner, alice.id);
      await registerInDb(past, alice.id);
      await registerInDb(others, bob.id);

      const res = await http()
        .get('/api/v1/registrations/me')
        .set('Cookie', alice.cookie)
        .expect(200);

      expect(res.body.map((r: { event: { title: string } }) => r.event.title)).toEqual([
        'Passé',
        'Bientôt',
        'Plus tard',
      ]);
      expect(res.body[1]).toEqual({
        id: expect.any(String),
        createdAt: expect.any(String),
        event: expect.objectContaining({
          id: sooner,
          capacity: 10,
          remainingSeats: 9,
          isFull: false,
        }),
      });
    });

    it('renvoie une liste vide sans inscription', async () => {
      const alice = await newParticipant();
      const res = await http()
        .get('/api/v1/registrations/me')
        .set('Cookie', alice.cookie)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('renvoie 401 sans session', async () => {
      await http().get('/api/v1/registrations/me').expect(401);
    });
  });
});
