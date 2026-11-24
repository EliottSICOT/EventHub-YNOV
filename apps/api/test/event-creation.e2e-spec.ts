import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AUTH_MESSAGES, SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { IMAGE_MESSAGES, MAX_IMAGE_BYTES } from '../src/events/event-image.js';
import { CATEGORY_NOT_FOUND_MESSAGE } from '../src/events/events.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resolveUploadsDir } from '../src/uploads/uploads.js';
import { assertTestDatabase } from './test-database.js';

const PASSWORD = 'motdepasse-solide';
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("Création d'un événement par un organisateur (e2e, US08)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryId: string;
  let organizer: string;
  let otherOrganizer: string;
  let participant: string;
  const uploadsDir = resolveUploadsDir();

  const http = () => request(app.getHttpServer());

  let accountCount = 0;
  /** Crée un compte, lui donne le rôle voulu et renvoie son cookie de session. */
  async function newAccount(role: 'PARTICIPANT' | 'ORGANIZER') {
    const email = `compte${++accountCount}@test.dev`;
    await http()
      .post('/api/v1/auth/sign-up')
      .send({ firstName: 'Camille', lastName: 'Martin', email, password: PASSWORD })
      .expect(201);
    await prisma.user.update({ where: { email }, data: { role } });
    const res = await http().post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
    const header = res.headers['set-cookie'] as unknown as string[];
    return header.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0];
  }

  const validBody = () => ({
    title: 'Nuit du jazz',
    description: 'Trois quartets sur scène.',
    categoryId,
    startsAt: inDays(10),
    endsAt: inDays(10.1),
    venue: 'Le Transbordeur',
    address: '3 boulevard de Stalingrad',
    city: 'Lyon',
    capacity: 300,
    priceCents: 1500,
  });

  const create = (body: object, cookie?: string) => {
    const req = http().post('/api/v1/events');
    return (cookie ? req.set('Cookie', cookie) : req).send(body);
  };

  const sendImage = (
    eventId: string,
    cookie: string | undefined,
    content?: Buffer,
    name = 'affiche.png',
  ) => {
    let req = http().post(`/api/v1/events/${eventId}/image`);
    if (cookie) req = req.set('Cookie', cookie);
    return content
      ? req.attach('image', content, { filename: name, contentType: 'image/png' })
      : req;
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
    organizer = await newAccount('ORGANIZER');
    otherOrganizer = await newAccount('ORGANIZER');
    participant = await newAccount('PARTICIPANT');
  });

  afterAll(async () => {
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  describe('POST /api/v1/events', () => {
    it("crée l'événement au nom de l'organisateur connecté (201)", async () => {
      const body = validBody();
      const res = await create(body, organizer).expect(201);

      const me = await http().get('/api/v1/auth/me').set('Cookie', organizer).expect(200);
      expect(res.body).toEqual({
        id: expect.any(String),
        title: 'Nuit du jazz',
        description: 'Trois quartets sur scène.',
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        venue: 'Le Transbordeur',
        address: '3 boulevard de Stalingrad',
        city: 'Lyon',
        capacity: 300,
        priceCents: 1500,
        remainingSeats: 300,
        isFull: false,
        imageUrl: null,
        category: { id: categoryId, name: 'Concert', slug: 'concert' },
        organizer: { id: me.body.id, name: 'Camille Martin' },
      });
    });

    it('fait apparaître le nouvel événement dans le catalogue public', async () => {
      const { body: event } = await create(
        { ...validBody(), title: 'Concert du catalogue', priceCents: 0 },
        organizer,
      ).expect(201);

      const list = await http().get('/api/v1/events?pageSize=50').expect(200);
      expect(list.body.data).toContainEqual(
        expect.objectContaining({ id: event.id, title: 'Concert du catalogue', priceCents: 0 }),
      );
      await http().get(`/api/v1/events/${event.id}`).expect(200);
    });

    it("refuse un organizerId dans le corps : l'organisateur vient de la session", async () => {
      const before = await prisma.event.count();
      const res = await create({ ...validBody(), organizerId: 'un-autre' }, organizer).expect(400);
      expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(['organizerId']);
      expect(await prisma.event.count()).toBe(before);
    });

    it('renvoie 403 à un participant', async () => {
      const before = await prisma.event.count();
      const res = await create(validBody(), participant).expect(403);
      expect(res.body).toMatchObject({ statusCode: 403, message: AUTH_MESSAGES.forbidden });
      expect(await prisma.event.count()).toBe(before);
    });

    it('renvoie 401 sans session', async () => {
      const res = await create(validBody()).expect(401);
      expect(res.body.message).toBe(AUTH_MESSAGES.unauthenticated);
    });

    it('refuse une date passée, une capacité à 0 et un prix négatif, champ par champ', async () => {
      const before = await prisma.event.count();
      const res = await create(
        { ...validBody(), startsAt: inDays(-1), endsAt: undefined, capacity: 0, priceCents: -100 },
        organizer,
      ).expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'La requête contient des champs invalides',
      });
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          { field: 'startsAt', message: 'La date de début doit être dans le futur' },
          { field: 'capacity', message: "La capacité doit être d'au moins 1 place" },
          { field: 'priceCents', message: 'Le prix doit être positif ou nul' },
        ]),
      );
      expect(res.body.details).toHaveLength(3);
      expect(await prisma.event.count()).toBe(before);
    });

    it('refuse une fin antérieure au début', async () => {
      const res = await create({ ...validBody(), endsAt: inDays(9) }, organizer).expect(400);
      expect(res.body.details).toEqual([
        { field: 'endsAt', message: 'La date de fin doit être postérieure à la date de début' },
      ]);
    });

    it('refuse une catégorie inconnue', async () => {
      const res = await create(
        { ...validBody(), categoryId: '00000000-0000-4000-8000-000000000000' },
        organizer,
      ).expect(400);
      expect(res.body.details).toEqual([
        { field: 'categoryId', message: CATEGORY_NOT_FOUND_MESSAGE },
      ]);
    });
  });

  describe('POST /api/v1/events/:id/image', () => {
    let eventId: string;

    beforeAll(async () => {
      eventId = (await create(validBody(), organizer).expect(201)).body.id;
    });

    it('enregistre un PNG, renomme le fichier et le sert sous /uploads', async () => {
      const res = await sendImage(eventId, organizer, PNG, 'mon affiche.png').expect(200);

      expect(res.body.id).toBe(eventId);
      expect(res.body.imageUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
      expect(existsSync(join(uploadsDir, basename(res.body.imageUrl)))).toBe(true);

      const file = await http().get(res.body.imageUrl).expect(200);
      expect(file.headers['content-type']).toBe('image/png');
      expect(file.headers['x-content-type-options']).toBe('nosniff');

      const detail = await http().get(`/api/v1/events/${eventId}`).expect(200);
      expect(detail.body.imageUrl).toBe(res.body.imageUrl);
    });

    it("remplace l'image et supprime l'ancien fichier", async () => {
      const first = (await sendImage(eventId, organizer, PNG).expect(200)).body.imageUrl;
      const second = await sendImage(eventId, organizer, JPEG, 'photo.png').expect(200);

      expect(second.body.imageUrl).toMatch(/\.jpg$/);
      expect(existsSync(join(uploadsDir, basename(first)))).toBe(false);
    });

    it("refuse un fichier qui n'est ni un JPG ni un PNG, même nommé .png", async () => {
      const before = (await prisma.event.findUnique({ where: { id: eventId } }))!.imageUrl;
      const res = await sendImage(eventId, organizer, Buffer.from('GIF89a…'), 'faux.png').expect(
        400,
      );
      expect(res.body.details).toEqual([{ field: 'image', message: IMAGE_MESSAGES.format }]);
      expect((await prisma.event.findUnique({ where: { id: eventId } }))!.imageUrl).toBe(before);
    });

    it('refuse un fichier de plus de 2 Mo avec un message en français', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
      const res = await sendImage(eventId, organizer, big).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(res.body.details).toEqual([{ field: 'image', message: IMAGE_MESSAGES.tooLarge }]);
    });

    it('refuse une requête sans fichier', async () => {
      const res = await sendImage(eventId, organizer).expect(400);
      expect(res.body.details).toEqual([{ field: 'image', message: IMAGE_MESSAGES.required }]);
    });

    it('renvoie 403 à un autre organisateur et à un participant', async () => {
      for (const cookie of [otherOrganizer, participant]) {
        const res = await sendImage(eventId, cookie, PNG).expect(403);
        expect(res.body.message).toBe(IMAGE_MESSAGES.notOrganizer);
      }
    });

    it('renvoie 404 pour un événement inconnu', async () => {
      const res = await sendImage('inconnu', organizer, PNG).expect(404);
      expect(res.body.message).toBe("L'événement demandé n'existe pas");
    });

    it('renvoie 401 sans session', async () => {
      await sendImage(eventId, undefined, PNG).expect(401);
    });
  });
});
