import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SEARCH_VECTOR } from '../src/events/events.search.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertTestDatabase } from './test-database.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const at = (offset: number) => new Date(Date.now() + offset);

describe('Recherche et tri du catalogue (e2e, US10)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  /** Titres des événements renvoyés, dans l'ordre. */
  async function titles(params: Record<string, string> = {}) {
    const res = await request(app.getHttpServer()).get('/api/v1/events').query(params).expect(200);
    const found = (res.body.data as { title: string }[]).map((e) => e.title);
    if (!params.pageSize) expect(res.body.meta.total).toBe(found.length);
    return found;
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

    const concert = await prisma.category.create({ data: { name: 'Concert', slug: 'concert' } });
    const meetup = await prisma.category.create({ data: { name: 'Meetup', slug: 'meetup' } });
    const user = (n: number) =>
      prisma.user.create({
        data: { email: `u${n}@test.dev`, passwordHash: 'x', firstName: 'A', lastName: String(n) },
      });
    const users = [await user(1), await user(2), await user(3)];

    const make = (
      title: string,
      description: string,
      startsAt: Date,
      extra: {
        city?: string;
        categoryId?: string;
        priceCents?: number;
        capacity?: number;
        cancelledAt?: Date;
        registered?: number;
      } = {},
    ) => {
      const { registered = 0, ...data } = extra;
      return prisma.event.create({
        data: {
          title,
          description,
          startsAt,
          venue: 'Salle',
          city: 'Lyon',
          capacity: 10,
          categoryId: concert.id,
          organizerId: users[0].id,
          ...data,
          registrations: { create: users.slice(0, registered).map((u) => ({ userId: u.id })) },
        },
      });
    };

    // Prix : 1500, 0, 3000, 1500. Places restantes : 10, 2, 0, 48.
    await make('Soirée Électro', 'Un set jusqu’à l’aube.', at(2 * DAY), { priceCents: 1500 });
    await make('Meetup Node.js', 'Rendez-vous des développeurs.', at(4 * DAY), {
      city: 'Paris',
      categoryId: meetup.id,
      capacity: 4,
      registered: 2,
    });
    await make('Nuit du jazz', 'Trois quartets, une œuvre inédite.', at(6 * DAY), {
      priceCents: 3000,
      capacity: 3,
      registered: 3,
    });
    await make('Jazz au parc', 'Concert en plein air, 100% acoustique.', at(8 * DAY), {
      city: 'Paris',
      priceCents: 1500,
      capacity: 50,
      registered: 2,
    });
    await make('Jazz passé', 'Déjà joué.', at(-DAY));
    await make('Jazz annulé', 'Supprimé.', at(DAY), { cancelledAt: new Date() });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('q', () => {
    it('cherche dans le titre et dans la description', async () => {
      expect(await titles({ q: 'jazz' })).toEqual(['Nuit du jazz', 'Jazz au parc']);
      expect(await titles({ q: 'quartets' })).toEqual(['Nuit du jazz']);
    });

    it.each(['soirée électro', 'SOIREE ELECTRO', 'soiree électro', 'ÉLECTRO'])(
      'ignore les majuscules et les accents : « %s »',
      async (q) => {
        expect(await titles({ q })).toEqual(['Soirée Électro']);
      },
    );

    it('ignore les accents du texte : une saisie sans ligature trouve « œuvre »', async () => {
      expect(await titles({ q: 'oeuvre' })).toEqual(['Nuit du jazz']);
      expect(await titles({ q: "l'œuvre" })).toEqual([]);
      expect(await titles({ q: 'ŒUVRE' })).toEqual(['Nuit du jazz']);
    });

    it('exige tous les mots, dans n’importe quel ordre, titre et description mêlés', async () => {
      expect(await titles({ q: 'parc jazz' })).toEqual(['Jazz au parc']);
      expect(await titles({ q: 'jazz acoustique' })).toEqual(['Jazz au parc']);
      expect(await titles({ q: 'jazz électro' })).toEqual([]);
    });

    it('trouve un mot par son début, pas par son milieu', async () => {
      expect(await titles({ q: 'quart' })).toEqual(['Nuit du jazz']);
      expect(await titles({ q: 'azz' })).toEqual([]);
    });

    it('trouve les mots composés et les noms à point', async () => {
      expect(await titles({ q: 'node.js' })).toEqual(['Meetup Node.js']);
      expect(await titles({ q: 'js' })).toEqual(['Meetup Node.js']);
      expect(await titles({ q: 'rendez-vous' })).toEqual(['Meetup Node.js']);
      expect(await titles({ q: 'vous' })).toEqual(['Meetup Node.js']);
    });

    it.each(["'", '& | !', "jazz' OR 1=1 --", 'jazz:*', '<->', '%', '\\'])(
      'reste sûr avec des caractères spéciaux : « %s »',
      async (q) => {
        await request(app.getHttpServer()).get('/api/v1/events').query({ q }).expect(200);
      },
    );

    it('ignore une recherche vide', async () => {
      expect(await titles({ q: '   ' })).toHaveLength(4);
    });

    it('refuse une recherche trop longue', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events')
        .query({ q: 'a'.repeat(101) })
        .expect(400);
      expect(res.body.details).toEqual([
        { field: 'q', message: 'q ne doit pas dépasser 100 caractères' },
      ]);
    });
  });

  describe('sort', () => {
    const byDate = ['Soirée Électro', 'Meetup Node.js', 'Nuit du jazz', 'Jazz au parc'];

    it.each([
      ['date', byDate],
      ['-date', [...byDate].reverse()],
      // À prix égal, le plus proche d'abord, dans les deux sens.
      ['price', ['Meetup Node.js', 'Soirée Électro', 'Jazz au parc', 'Nuit du jazz']],
      ['-price', ['Nuit du jazz', 'Soirée Électro', 'Jazz au parc', 'Meetup Node.js']],
      ['seats', ['Nuit du jazz', 'Meetup Node.js', 'Soirée Électro', 'Jazz au parc']],
      ['-seats', ['Jazz au parc', 'Soirée Électro', 'Meetup Node.js', 'Nuit du jazz']],
    ])('%s', async (sort, expected) => {
      expect(await titles({ sort })).toEqual(expected);
    });

    it('trie par date croissante par défaut', async () => {
      expect(await titles()).toEqual(byDate);
    });

    it('trie avant de paginer', async () => {
      expect(await titles({ sort: '-price', pageSize: '2', page: '1' })).toEqual([
        'Nuit du jazz',
        'Soirée Électro',
      ]);
      expect(await titles({ sort: '-price', pageSize: '2', page: '2' })).toEqual([
        'Jazz au parc',
        'Meetup Node.js',
      ]);
    });

    it('refuse un tri inconnu', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events')
        .query({ sort: 'titre' })
        .expect(400);
      expect(res.body.details[0].field).toBe('sort');
    });
  });

  it('combine la recherche, le tri et les filtres (US02)', async () => {
    expect(await titles({ q: 'jazz', city: 'paris' })).toEqual(['Jazz au parc']);
    expect(await titles({ q: 'jazz', category: 'meetup' })).toEqual([]);
    expect(await titles({ category: 'concert', sort: 'seats' })).toEqual([
      'Nuit du jazz',
      'Soirée Électro',
      'Jazz au parc',
    ]);
    expect(
      await titles({
        q: 'jazz',
        sort: 'price',
        to: at(7 * DAY)
          .toISOString()
          .slice(0, 10),
      }),
    ).toEqual(['Nuit du jazz']);
  });

  it('traite un joker de LIKE comme un caractère dans le filtre ville', async () => {
    expect(await titles({ city: '%' })).toEqual([]);
    expect(await titles({ city: '_yon' })).toEqual([]);
  });

  it('compare les dates en UTC : exclut ce qui vient de commencer, garde ce qui va commencer', async () => {
    const { categoryId, organizerId } = await prisma.event.findFirstOrThrow();
    const base = {
      description: 'd',
      venue: 'v',
      city: 'Nice',
      capacity: 1,
      categoryId,
      organizerId,
    };
    await prisma.event.createMany({
      data: [
        { ...base, title: 'Commencé', startsAt: at(-5 * MINUTE) },
        { ...base, title: 'Imminent', startsAt: at(5 * MINUTE) },
      ],
    });
    expect(await titles({ city: 'Nice' })).toEqual(['Imminent']);
  });

  it("peut utiliser l'index plein texte", async () => {
    const plan = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      return tx.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN SELECT e.id FROM events e
        WHERE ${SEARCH_VECTOR} @@ to_tsquery('public.eventhub_search'::regconfig, ${'jazz:*'})`;
    });
    expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain('events_search_idx');
  });
});
