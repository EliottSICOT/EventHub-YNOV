import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AUTH_MESSAGES, SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { EVENT_NOT_FOUND_MESSAGE } from '../src/events/events.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REGISTRATION_MESSAGES } from '../src/registrations/registrations.constants.js';
import { assertTestDatabase } from './test-database.js';

const PASSWORD = 'motdepasse-solide';
const DAY = 24 * 60 * 60 * 1000;
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const HEADER = "Nom;Prénom;Email;Date d'inscription";

/** Corps brut de la réponse, pour vérifier les octets (BOM, CRLF) et non une chaîne décodée. */
function rawBody(res: request.Response, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Export des inscrits en CSV (e2e, US13)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let categoryId: string;
  let organizer: { id: string; cookie: string };
  let otherOrganizer: { id: string; cookie: string };
  let participant: { id: string; cookie: string };

  const http = () => request(app.getHttpServer());

  let accountCount = 0;
  async function newAccount(role: 'PARTICIPANT' | 'ORGANIZER') {
    const email = `export${++accountCount}@test.dev`;
    await http()
      .post('/api/v1/auth/sign-up')
      .send({ firstName: 'Camille', lastName: 'Martin', email, password: PASSWORD })
      .expect(201);
    const { id } = await prisma.user.update({ where: { email }, data: { role } });
    const res = await http().post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
    const header = res.headers['set-cookie'] as unknown as string[];
    return { id, cookie: header.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0] };
  }

  /** Inscrit directement en base, à une date choisie, un utilisateur aux nom et prénom donnés. */
  async function registerAt(
    eventId: string,
    createdAt: string,
    lastName: string,
    firstName: string,
  ) {
    const user = await prisma.user.create({
      data: {
        email: `inscrit${++accountCount}@test.dev`,
        passwordHash: 'inutilisé',
        firstName,
        lastName,
      },
    });
    await prisma.registration.create({
      data: { eventId, userId: user.id, createdAt: new Date(createdAt) },
    });
    return user.email;
  }

  async function createEvent(title: string, startsAt: string) {
    const event = await prisma.event.create({
      data: {
        title,
        description: 'Programme.',
        startsAt: new Date(startsAt),
        venue: 'Le Transbordeur',
        city: 'Lyon',
        capacity: 10,
        categoryId,
        organizerId: organizer.id,
      },
    });
    return event.id;
  }

  const exportCsv = (id: string, cookie?: string) => {
    const req = http().get(`/api/v1/events/${id}/registrations.csv`);
    return cookie ? req.set('Cookie', cookie) : req;
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
  });

  it("renvoie à l'organisateur le CSV de ses inscrits, triés par date d'inscription", async () => {
    const startsAt = new Date(Date.now() + 30 * DAY);
    const id = await createEvent('Fête de la musique : édition 2026', startsAt.toISOString());
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(startsAt);
    const lea = await registerAt(id, '2026-11-21T17:42:00.000Z', 'Lefèvre', 'Éloïse');
    const jean = await registerAt(id, '2026-11-20T09:15:00.000Z', 'O"Neil; Jr', 'Jean');
    const pirate = await registerAt(id, '2026-11-22T08:00:00.000Z', 'Pirate', '=1+1');

    const res = await exportCsv(id, organizer.cookie).buffer(true).parse(rawBody).expect(200);

    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="inscrits-fete-de-la-musique-edition-2026-${day}.csv"; ` +
        `filename*=UTF-8''inscrits-f%C3%AAte-de-la-musique-%C3%A9dition-2026-${day}.csv`,
    );

    const body = res.body as Buffer;
    expect(body.subarray(0, 3)).toEqual(UTF8_BOM);
    expect(body.subarray(3).toString('utf8')).toBe(
      [
        HEADER,
        `"O""Neil; Jr";Jean;${jean};20/11/2026 10:15`,
        `Lefèvre;Éloïse;${lea};21/11/2026 18:42`,
        `Pirate;'=1+1;${pirate};22/11/2026 09:00`,
        '',
      ].join('\r\n'),
    );
  });

  it("renvoie seulement la ligne d'en-tête pour un événement sans inscrit", async () => {
    const id = await createEvent('Atelier vide', '2026-12-24T10:00:00.000Z');
    const res = await exportCsv(id, organizer.cookie).buffer(true).parse(rawBody).expect(200);
    expect((res.body as Buffer).toString('utf8')).toBe(`${UTF8_BOM.toString('utf8')}${HEADER}\r\n`);
    expect(res.headers['content-disposition']).toContain(
      'filename="inscrits-atelier-vide-2026-12-24.csv"',
    );
  });

  it("renvoie 403 à l'organisateur d'un autre événement", async () => {
    const id = await createEvent('Nuit du jazz', '2026-12-05T19:00:00.000Z');
    const res = await exportCsv(id, otherOrganizer.cookie).expect(403);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body).toMatchObject({
      statusCode: 403,
      message: REGISTRATION_MESSAGES.exportNotOrganizer,
      path: `/api/v1/events/${id}/registrations.csv`,
    });
  });

  it('renvoie 403 à un participant', async () => {
    const id = await createEvent('Nuit du jazz', '2026-12-05T19:00:00.000Z');
    const res = await exportCsv(id, participant.cookie).expect(403);
    expect(res.body).toMatchObject({ statusCode: 403, message: AUTH_MESSAGES.forbidden });
  });

  it('renvoie 401 sans session', async () => {
    const id = await createEvent('Nuit du jazz', '2026-12-05T19:00:00.000Z');
    const res = await exportCsv(id).expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, message: AUTH_MESSAGES.unauthenticated });
  });

  it('renvoie 404 pour un événement inconnu', async () => {
    const res = await exportCsv(randomUUID(), organizer.cookie).expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, message: EVENT_NOT_FOUND_MESSAGE });
  });
});
