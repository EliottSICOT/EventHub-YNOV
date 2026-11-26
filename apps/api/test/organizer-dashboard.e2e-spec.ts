import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AUTH_MESSAGES, SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { EVENT_NOT_FOUND_MESSAGE } from '../src/events/events.service.js';
import { REGISTRATION_MESSAGES } from '../src/registrations/registrations.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertTestDatabase } from './test-database.js';

const PASSWORD = 'motdepasse-solide';

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe('Tableau de bord organisateur (e2e, US12)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryId: string;
  let organizerId: string;
  let organizer: string;
  let participant: string;
  let upcomingId: string;
  let pastId: string;
  let otherEventId: string;

  const http = () => request(app.getHttpServer());

  let accountCount = 0;
  async function newAccount(role: 'PARTICIPANT' | 'ORGANIZER') {
    const email = `dashboard${++accountCount}@test.dev`;
    await http()
      .post('/api/v1/auth/sign-up')
      .send({ firstName: 'Camille', lastName: 'Martin', email, password: PASSWORD })
      .expect(201);
    const user = await prisma.user.update({ where: { email }, data: { role } });
    const res = await http().post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
    const header = res.headers['set-cookie'] as unknown as string[];
    const cookie = header.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0];
    return { cookie, userId: user.id, email };
  }

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
    const org = await newAccount('ORGANIZER');
    organizer = org.cookie;
    organizerId = org.userId;
    await newAccount('ORGANIZER');
    const part = await newAccount('PARTICIPANT');
    participant = part.cookie;

    const upcoming = await prisma.event.create({
      data: {
        title: 'Nuit du jazz',
        description: 'Trois quartets.',
        startsAt: inDays(10),
        venue: 'Le Transbordeur',
        city: 'Lyon',
        capacity: 100,
        priceCents: 1500,
        categoryId,
        organizerId,
      },
    });
    upcomingId = upcoming.id;

    const past = await prisma.event.create({
      data: {
        title: 'Soirée passée',
        description: 'Déjà terminée.',
        startsAt: inDays(-5),
        venue: 'Le Transbordeur',
        city: 'Lyon',
        capacity: 50,
        priceCents: 0,
        categoryId,
        organizerId,
      },
    });
    pastId = past.id;

    const otherOrg = await prisma.user.findFirstOrThrow({
      where: { role: 'ORGANIZER', id: { not: organizerId } },
    });
    const otherEvent = await prisma.event.create({
      data: {
        title: 'Pas le mien',
        description: 'Appartient à un autre.',
        startsAt: inDays(7),
        venue: 'Station F',
        city: 'Paris',
        capacity: 20,
        priceCents: 0,
        categoryId,
        organizerId: otherOrg.id,
      },
    });
    otherEventId = otherEvent.id;

    await prisma.registration.create({
      data: { eventId: upcomingId, userId: part.userId },
    });
    await prisma.user.update({
      where: { id: part.userId },
      data: { firstName: 'Alice', lastName: 'Dupont' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/events/mine', () => {
    it('liste uniquement mes événements avec remplissage (200)', async () => {
      const res = await http().get('/api/v1/events/mine').set('Cookie', organizer).expect(200);

      expect(res.body).toEqual([
        {
          id: pastId,
          title: 'Soirée passée',
          startsAt: expect.any(String),
          capacity: 50,
          registeredCount: 0,
          fillRate: 0,
        },
        {
          id: upcomingId,
          title: 'Nuit du jazz',
          startsAt: expect.any(String),
          capacity: 100,
          registeredCount: 1,
          fillRate: 1,
        },
      ]);
      expect(res.body.map((e: { id: string }) => e.id)).not.toContain(otherEventId);
    });

    it('refuse un participant (403)', async () => {
      const res = await http().get('/api/v1/events/mine').set('Cookie', participant).expect(403);
      expect(res.body.message).toBe(AUTH_MESSAGES.forbidden);
    });

    it('refuse sans session (401)', async () => {
      const res = await http().get('/api/v1/events/mine').expect(401);
      expect(res.body.message).toBe(AUTH_MESSAGES.unauthenticated);
    });
  });

  describe('GET /api/v1/events/:id/registrations', () => {
    it("renvoie les inscrits de mon événement (200)", async () => {
      const res = await http()
        .get(`/api/v1/events/${upcomingId}/registrations`)
        .set('Cookie', organizer)
        .expect(200);

      expect(res.body).toEqual([
        {
          lastName: 'Dupont',
          firstName: 'Alice',
          email: expect.stringContaining('@test.dev'),
          registeredAt: expect.any(String),
        },
      ]);
    });

    it("refuse l'événement d'un autre organisateur (403)", async () => {
      const res = await http()
        .get(`/api/v1/events/${otherEventId}/registrations`)
        .set('Cookie', organizer)
        .expect(403);
      expect(res.body.message).toBe(REGISTRATION_MESSAGES.notEventOrganizer);
    });

    it('refuse un participant (403)', async () => {
      await http()
        .get(`/api/v1/events/${upcomingId}/registrations`)
        .set('Cookie', participant)
        .expect(403);
    });

    it('renvoie 404 pour un événement inconnu', async () => {
      const res = await http()
        .get('/api/v1/events/00000000-0000-4000-8000-000000000099/registrations')
        .set('Cookie', organizer)
        .expect(404);
      expect(res.body.message).toBe(EVENT_NOT_FOUND_MESSAGE);
    });

    it('refuse sans session (401)', async () => {
      await http().get(`/api/v1/events/${upcomingId}/registrations`).expect(401);
    });
  });
});
