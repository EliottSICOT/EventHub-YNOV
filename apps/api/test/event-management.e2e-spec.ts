import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AUTH_MESSAGES, SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { MANAGE_EVENT_MESSAGES } from '../src/events/events.constants.js';
import { CATEGORY_NOT_FOUND_MESSAGE } from '../src/events/events.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REGISTRATION_MESSAGES } from '../src/registrations/registrations.constants.js';
import { assertTestDatabase } from './test-database.js';

const PASSWORD = 'motdepasse-solide';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const at = (offset: number) => new Date(Date.now() + offset);

describe("Modification et suppression d'un événement (e2e, US09)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryId: string;
  let otherCategoryId: string;
  let organizer: { id: string; cookie: string };
  let otherOrganizer: { id: string; cookie: string };

  const http = () => request(app.getHttpServer());

  let accountCount = 0;
  async function newAccount(role: 'PARTICIPANT' | 'ORGANIZER' = 'PARTICIPANT') {
    const email = `compte${++accountCount}@test.dev`;
    await http()
      .post('/api/v1/auth/sign-up')
      .send({ firstName: 'Camille', lastName: 'Martin', email, password: PASSWORD })
      .expect(201);
    const { id } = await prisma.user.update({ where: { email }, data: { role } });
    const res = await http().post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
    const header = res.headers['set-cookie'] as unknown as string[];
    return { id, cookie: header.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0] };
  }

  async function createEvent(overrides: { capacity?: number; startsAt?: Date } = {}) {
    const event = await prisma.event.create({
      data: {
        title: 'Nuit du jazz',
        description: 'Trois quartets sur scène.',
        startsAt: at(10 * DAY),
        endsAt: at(10 * DAY + 180 * MINUTE),
        venue: 'Le Transbordeur',
        address: '3 boulevard de Stalingrad',
        city: 'Lyon',
        capacity: 10,
        categoryId,
        organizerId: organizer.id,
        ...overrides,
      },
    });
    return event.id;
  }

  const body = (overrides: object = {}) => ({
    title: 'Nuit du blues',
    description: 'Nouveau programme.',
    categoryId: otherCategoryId,
    startsAt: at(20 * DAY).toISOString(),
    venue: 'La Cigale',
    city: 'Paris',
    capacity: 50,
    priceCents: 2500,
    ...overrides,
  });

  const update = (id: string, cookie: string | undefined, data: object = body()) => {
    const req = http().put(`/api/v1/events/${id}`);
    return (cookie ? req.set('Cookie', cookie) : req).send(data);
  };
  const remove = (id: string, cookie?: string) => {
    const req = http().delete(`/api/v1/events/${id}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const register = (id: string, cookie: string) =>
    http().post(`/api/v1/events/${id}/registrations`).set('Cookie', cookie);
  const catalogueIds = async () => {
    const res = await http().get('/api/v1/events?pageSize=50').expect(200);
    return (res.body.data as { id: string }[]).map((e) => e.id);
  };

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
    otherCategoryId = (await prisma.category.create({ data: { name: 'Sport', slug: 'sport' } })).id;
    organizer = await newAccount('ORGANIZER');
    otherOrganizer = await newAccount('ORGANIZER');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PUT /api/v1/events/:id', () => {
    it("remplace les champs de l'événement et efface les champs facultatifs absents", async () => {
      const id = await createEvent();
      const data = body();

      const res = await update(id, organizer.cookie, data).expect(200);
      expect(res.body).toMatchObject({
        id,
        title: 'Nuit du blues',
        description: 'Nouveau programme.',
        startsAt: data.startsAt,
        endsAt: null,
        venue: 'La Cigale',
        address: null,
        city: 'Paris',
        capacity: 50,
        priceCents: 2500,
        remainingSeats: 50,
        isCancelled: false,
        category: { id: otherCategoryId, name: 'Sport', slug: 'sport' },
        organizer: { id: organizer.id },
      });

      const detail = await http().get(`/api/v1/events/${id}`).expect(200);
      expect(detail.body).toEqual(res.body);
    });

    it('garde les inscriptions et recalcule les places restantes', async () => {
      const id = await createEvent({ capacity: 3 });
      await register(id, (await newAccount()).cookie).expect(201);
      const res = await update(id, organizer.cookie, body({ capacity: 5 })).expect(200);
      expect(res.body).toMatchObject({ capacity: 5, remainingSeats: 4 });
    });

    it('renvoie 401 sans session', async () => {
      await update(await createEvent(), undefined).expect(401);
    });

    it('renvoie 403 à un participant', async () => {
      const res = await update(await createEvent(), (await newAccount()).cookie).expect(403);
      expect(res.body.message).toBe(AUTH_MESSAGES.forbidden);
    });

    it('renvoie 403 à un autre organisateur, sans rien modifier', async () => {
      const id = await createEvent();
      const res = await update(id, otherOrganizer.cookie).expect(403);
      expect(res.body.message).toBe(MANAGE_EVENT_MESSAGES.notOrganizer);
      expect((await prisma.event.findUniqueOrThrow({ where: { id } })).title).toBe('Nuit du jazz');
    });

    it('renvoie 404 pour un événement inconnu', async () => {
      await update('inconnu', organizer.cookie).expect(404);
    });

    it('reprend les validations de la création (US08)', async () => {
      const id = await createEvent();
      const res = await update(
        id,
        organizer.cookie,
        body({ title: '', startsAt: at(-DAY).toISOString(), capacity: 0, priceCents: -1 }),
      ).expect(400);
      const fields = (res.body.details as { field: string }[]).map((d) => d.field);
      expect(new Set(fields)).toEqual(new Set(['title', 'startsAt', 'capacity', 'priceCents']));
    });

    it('refuse une catégorie inconnue et un champ hors contrat', async () => {
      const id = await createEvent();
      const category = await update(id, organizer.cookie, body({ categoryId: 'x' })).expect(400);
      expect(category.body.details).toEqual([
        { field: 'categoryId', message: CATEGORY_NOT_FOUND_MESSAGE },
      ]);
      await update(id, organizer.cookie, body({ organizerId: otherOrganizer.id })).expect(400);
    });

    it("refuse une capacité inférieure au nombre d'inscrits, accepte l'égalité", async () => {
      const id = await createEvent({ capacity: 3 });
      await register(id, (await newAccount()).cookie).expect(201);
      await register(id, (await newAccount()).cookie).expect(201);

      const res = await update(id, organizer.cookie, body({ capacity: 1 })).expect(400);
      expect(res.body.details).toEqual([
        { field: 'capacity', message: MANAGE_EVENT_MESSAGES.capacityBelowRegistrations(2) },
      ]);

      const equal = await update(id, organizer.cookie, body({ capacity: 2 })).expect(200);
      expect(equal.body).toMatchObject({ remainingSeats: 0, isFull: true });
    });

    it('ne passe jamais sous le nombre d’inscrits quand on s’inscrit en même temps', async () => {
      const id = await createEvent({ capacity: 6 });
      const participants = await Promise.all(Array.from({ length: 6 }, () => newAccount()));

      await Promise.all([
        ...participants.slice(0, 3).map((p) => register(id, p.cookie)),
        update(id, organizer.cookie, body({ capacity: 2 })),
        ...participants.slice(3).map((p) => register(id, p.cookie)),
      ]);

      const { capacity } = await prisma.event.findUniqueOrThrow({ where: { id } });
      const registered = await prisma.registration.count({ where: { eventId: id } });
      expect(registered).toBeLessThanOrEqual(capacity);
    });

    it('refuse de modifier un événement qui a commencé (409)', async () => {
      const started = await createEvent({ startsAt: at(-30 * MINUTE) });
      const res = await update(started, organizer.cookie).expect(409);
      expect(res.body.message).toBe(MANAGE_EVENT_MESSAGES.past);

      const soon = await createEvent({ startsAt: at(30 * MINUTE) });
      await update(soon, organizer.cookie).expect(200);
    });
  });

  describe('DELETE /api/v1/events/:id', () => {
    it("retire l'événement du catalogue, mais le détail indique l'annulation", async () => {
      const id = await createEvent();
      expect(await catalogueIds()).toContain(id);

      await remove(id, organizer.cookie).expect(204);

      expect(await catalogueIds()).not.toContain(id);
      const detail = await http().get(`/api/v1/events/${id}`).expect(200);
      expect(detail.body.isCancelled).toBe(true);
    });

    it('garde les inscriptions, marquées annulées chez les inscrits', async () => {
      const id = await createEvent();
      const participant = await newAccount();
      await register(id, participant.cookie).expect(201);

      await remove(id, organizer.cookie).expect(204);

      const res = await http()
        .get('/api/v1/registrations/me')
        .set('Cookie', participant.cookie)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].event).toMatchObject({ id, title: 'Nuit du jazz', isCancelled: true });
    });

    it("ferme les inscriptions et empêche d'annuler la sienne (409)", async () => {
      const id = await createEvent();
      const participant = await newAccount();
      const registration = await register(id, participant.cookie).expect(201);
      await remove(id, organizer.cookie).expect(204);

      const refused = await register(id, (await newAccount()).cookie).expect(409);
      expect(refused.body.message).toBe(REGISTRATION_MESSAGES.eventCancelled);

      const cancel = await http()
        .delete(`/api/v1/registrations/${registration.body.id}`)
        .set('Cookie', participant.cookie)
        .expect(409);
      expect(cancel.body.message).toBe(REGISTRATION_MESSAGES.cancelCancelled);
    });

    it('renvoie 401 sans session, 403 aux autres et 404 si inconnu', async () => {
      const id = await createEvent();
      await remove(id).expect(401);
      await remove(id, (await newAccount()).cookie).expect(403);
      const res = await remove(id, otherOrganizer.cookie).expect(403);
      expect(res.body.message).toBe(MANAGE_EVENT_MESSAGES.notOrganizer);
      await remove('inconnu', organizer.cookie).expect(404);
      expect(await catalogueIds()).toContain(id);
    });

    it('refuse de supprimer deux fois, ou de modifier un événement supprimé (409)', async () => {
      const id = await createEvent();
      await remove(id, organizer.cookie).expect(204);

      for (const res of [await remove(id, organizer.cookie), await update(id, organizer.cookie)]) {
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(MANAGE_EVENT_MESSAGES.alreadyCancelled);
      }
    });

    it('refuse de supprimer un événement qui a commencé (409)', async () => {
      const id = await createEvent({ startsAt: at(-30 * MINUTE) });
      const res = await remove(id, organizer.cookie).expect(409);
      expect(res.body.message).toBe(MANAGE_EVENT_MESSAGES.past);
    });
  });
});
