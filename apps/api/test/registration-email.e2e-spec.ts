import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { type Mail, MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertTestDatabase } from './test-database.js';

const EMAIL = 'lea@test.dev';
const PASSWORD = 'motdepasse-solide';
const DAY = 24 * 60 * 60 * 1000;

describe("E-mail de confirmation d'inscription (e2e)", () => {
  const send = vi.fn<(mail: Mail) => Promise<void>>();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let categoryId: string;
  let organizerId: string;

  const http = () => request(app.getHttpServer());
  const register = (eventId: string) =>
    http().post(`/api/v1/events/${eventId}/registrations`).set('Cookie', cookie);

  async function createEvent(overrides: { capacity?: number; startsAt?: Date } = {}) {
    const event = await prisma.event.create({
      data: {
        title: 'Nuit du jazz',
        description: 'Description',
        startsAt: new Date(Date.now() + 5 * DAY),
        venue: 'Le Transbordeur',
        city: 'Lyon',
        capacity: 10,
        categoryId,
        organizerId,
        ...overrides,
      },
    });
    return event.id;
  }

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL!);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send })
      .compile();
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

    await http()
      .post('/api/v1/auth/sign-up')
      .send({ firstName: 'Léa', lastName: 'Dupont', email: EMAIL, password: PASSWORD })
      .expect(201);
    const res = await http()
      .post('/api/v1/auth/sign-in')
      .send({ email: EMAIL, password: PASSWORD });
    const header = res.headers['set-cookie'] as unknown as string[];
    cookie = header.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0];
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('envoie un e-mail au participant après une inscription confirmée', async () => {
    await register(await createEvent()).expect(201);

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const [mail] = send.mock.calls[0];
    expect(mail.to).toEqual({ name: 'Léa Dupont', address: EMAIL });
    expect(mail.subject).toBe('Inscription confirmée : Nuit du jazz');
    expect(mail.text).toContain('Le Transbordeur, Lyon');
    expect(mail.text).toContain('/me/registrations');
  });

  it("n'attend pas l'envoi pour répondre", async () => {
    send.mockReturnValue(new Promise(() => {}));
    await register(await createEvent()).expect(201);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  it("garde l'inscription et journalise l'erreur si l'envoi échoue", async () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    send.mockRejectedValue(new Error('SMTP indisponible'));
    const eventId = await createEvent();

    const res = await register(eventId).expect(201);

    await vi.waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        `Échec de l'e-mail de confirmation pour l'inscription ${res.body.id}`,
        expect.stringContaining('SMTP indisponible'),
      ),
    );
    expect(await prisma.registration.count({ where: { eventId } })).toBe(1);
  });

  it("n'envoie rien quand l'inscription est refusée", async () => {
    const past = await createEvent({ startsAt: new Date(Date.now() - DAY) });
    await register(past).expect(409);
    await register('inconnu').expect(404);

    // Une inscription valide ensuite : son e-mail est le seul envoyé.
    await register(await createEvent()).expect(201);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("n'envoie qu'un e-mail quand la seconde inscription au même événement est refusée", async () => {
    const eventId = await createEvent();
    await register(eventId).expect(201);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await register(eventId).expect(409);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(send).toHaveBeenCalledTimes(1);
  });
});
