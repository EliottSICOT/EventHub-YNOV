import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertTestDatabase } from './test-database.js';

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe('Catalogue des événements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL!);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.registration.deleteMany();
    await prisma.event.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();

    const concert = await prisma.category.create({
      data: { name: 'Concert', slug: 'concert' },
    });
    const sport = await prisma.category.create({
      data: { name: 'Sport', slug: 'sport' },
    });
    const organizer = await prisma.user.create({
      data: {
        email: 'orga@test.dev',
        passwordHash: 'x',
        firstName: 'Camille',
        lastName: 'Martin',
        role: 'ORGANIZER',
      },
    });
    const participant = await prisma.user.create({
      data: {
        email: 'p@test.dev',
        passwordHash: 'x',
        firstName: 'Paul',
        lastName: 'Durand',
      },
    });

    const base = {
      description: 'Description',
      venue: 'Salle',
      organizerId: organizer.id,
    };
    const make = (title: string, days: number, city: string, categoryId: string, capacity = 100) =>
      prisma.event.create({
        data: {
          ...base,
          title,
          startsAt: inDays(days),
          city,
          categoryId,
          capacity,
        },
      });

    ids.past = (await make('Passé', -5, 'Lyon', concert.id)).id;
    ids.jazz = (await make('Jazz à Lyon', 2, 'Lyon', concert.id)).id;
    await prisma.event.update({ where: { id: ids.jazz }, data: { priceCents: 1800 } });
    ids.rock = (await make('Rock à Paris', 4, 'Paris', concert.id)).id;
    ids.run = (await make('Course à Lyon', 6, 'Lyon', sport.id)).id;
    ids.full = (await make('Complet', 8, 'Nantes', sport.id, 1)).id;
    await prisma.registration.create({
      data: { eventId: ids.full, userId: participant.id },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/events', () => {
    it('liste les événements à venir triés par date, avec pagination', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/events?pageSize=3').expect(200);

      expect(res.body.data.map((e: { title: string }) => e.title)).toEqual([
        'Jazz à Lyon',
        'Rock à Paris',
        'Course à Lyon',
      ]);
      expect(res.body.meta).toEqual({
        page: 1,
        pageSize: 3,
        total: 4,
        totalPages: 2,
      });
    });

    it('renvoie la deuxième page', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events?pageSize=3&page=2')
        .expect(200);
      expect(res.body.data.map((e: { title: string }) => e.title)).toEqual(['Complet']);
    });

    it('calcule les places restantes', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/events').expect(200);
      const full = res.body.data.find((e: { id: string }) => e.id === ids.full);
      expect(full).toMatchObject({
        capacity: 1,
        remainingSeats: 0,
        isFull: true,
      });
    });

    it('combine les filtres catégorie et ville', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events?category=concert&city=LYON')
        .expect(200);
      expect(res.body.data.map((e: { id: string }) => e.id)).toEqual([ids.jazz]);
    });

    it('filtre par période', async () => {
      const day = (d: number) => inDays(d).toISOString().slice(0, 10);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/events?from=${day(3)}&to=${day(6)}`)
        .expect(200);
      expect(res.body.data.map((e: { id: string }) => e.id)).toEqual([ids.rock, ids.run]);
    });

    it('n’affiche aucun événement passé, même avec un `from` dans le passé (#46)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events?from=2020-01-01')
        .expect(200);

      const now = Date.now();
      expect(res.body.data.map((e: { id: string }) => e.id)).not.toContain(ids.past);
      expect(
        res.body.data.filter((e: { startsAt: string }) => Date.parse(e.startsAt) < now),
      ).toEqual([]);
      // Même résultat que sans filtre : 4 événements à venir, compteur cohérent.
      expect(res.body.meta).toEqual({ page: 1, pageSize: 12, total: 4, totalPages: 1 });
    });

    it('renvoie une liste vide sans erreur', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events?city=Marseille')
        .expect(200);
      expect(res.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
      });
    });

    it('refuse un paramètre invalide au format commun', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events?pageSize=500&from=hier')
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
        'from',
        'pageSize',
      ]);
    });
  });

  describe('GET /api/v1/events/:id', () => {
    it("renvoie le détail avec l'organisateur", async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/events/${ids.jazz}`).expect(200);
      expect(res.body).toMatchObject({
        title: 'Jazz à Lyon',
        description: 'Description',
        organizer: { name: 'Camille Martin' },
        category: { slug: 'concert' },
        remainingSeats: 100,
        priceCents: 1800,
      });
    });

    it('renvoie une 404 au format commun pour un identifiant inconnu', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/events/inconnu').expect(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: "L'événement demandé n'existe pas",
        path: '/api/v1/events/inconnu',
      });
    });
  });

  it('GET /api/v1/categories liste les catégories par nom', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(res.body.map((c: { slug: string }) => c.slug)).toEqual(['concert', 'sport']);
  });
});
