/**
 * Données de démonstration : catégories, organisateurs, participants, événements et inscriptions.
 * Les dates sont relatives au jour du seed pour que le catalogue reste « à venir ».
 * Usage : pnpm --filter api db:seed (idempotent : vide les tables avant d'insérer).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Mot de passe de tous les comptes de démo (documenté dans le README). */
const DEMO_PASSWORD = 'eventhub-demo';

const categories = [
  { name: 'Concert', slug: 'concert' },
  { name: 'Conférence', slug: 'conference' },
  { name: 'Atelier', slug: 'atelier' },
  { name: 'Sport', slug: 'sport' },
  { name: 'Théâtre', slug: 'theatre' },
  { name: 'Meetup tech', slug: 'meetup-tech' },
];

const cities = [
  {
    city: 'Lyon',
    venues: [
      ['Le Transbordeur', '3 boulevard de Stalingrad'],
      ['La Sucrière', '49-50 quai Rambaud'],
      ['Halle Tony Garnier', '20 place des Docteurs Charles et Christophe Mérieux'],
    ],
  },
  {
    city: 'Paris',
    venues: [
      ['La Cigale', '120 boulevard de Rochechouart'],
      ['Station F', '5 parvis Alan Turing'],
    ],
  },
  {
    city: 'Bordeaux',
    venues: [
      ['Darwin', '87 quai des Queyries'],
      ['Rocher de Palmer', '1 rue Aristide Briand, Cenon'],
    ],
  },
  { city: 'Nantes', venues: [['Stereolux', '4 boulevard Léon Bureau']] },
  {
    city: 'Toulouse',
    venues: [['Le Bikini', 'rue Théodore Monod, Ramonville']],
  },
] as const;

const titles: Record<string, string[]> = {
  concert: ['Nuit du jazz', 'Festival électro', 'Rock en plein air', 'Soirée chanson française'],
  conference: ['Sommet IA & société', 'Conférence climat', 'Futur du travail'],
  atelier: ['Atelier céramique', 'Initiation à la photo', 'Atelier cuisine du monde'],
  sport: ['Course des quais', 'Tournoi de basket 3x3', 'Yoga au parc'],
  theatre: ['Molière revisité', 'Impro du jeudi', 'Seul en scène'],
  'meetup-tech': [
    'Meetup TypeScript',
    'React & performances',
    'Postgres en production',
    'DevOps afterwork',
  ],
};

function daysFromNow(days: number, hour: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  await prisma.waitlistEntry.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Un seul hash argon2 pour tous les comptes : le seed reste rapide.
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const createdCategories = await Promise.all(
    categories.map((data) => prisma.category.create({ data })),
  );

  const organizers = await Promise.all(
    [
      ['Camille', 'Martin'],
      ['Yanis', 'Bernard'],
    ].map(([firstName, lastName]) =>
      prisma.user.create({
        data: {
          email: `${firstName.toLowerCase()}@eventhub.test`,
          passwordHash,
          firstName,
          lastName,
          role: Role.ORGANIZER,
        },
      }),
    ),
  );

  const participants = await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      prisma.user.create({
        data: {
          email: `participant${i + 1}@eventhub.test`,
          passwordHash,
          firstName: 'Participant',
          lastName: String(i + 1),
        },
      }),
    ),
  );

  let index = 0;
  for (const category of createdCategories) {
    for (const title of titles[category.slug]) {
      const place = cities[index % cities.length];
      const [venue, address] = place.venues[index % place.venues.length];
      const startsAt = daysFromNow(3 + index * 4, 18 + (index % 3));
      // Un événement sur sept est complet, les autres ont une petite jauge pour rendre le badge visible.
      const capacity = index % 7 === 0 ? 10 : [25, 40, 80, 150][index % 4];
      const registrations = index % 7 === 0 ? 10 : Math.min(capacity - 1, (index * 7) % 40);

      const event = await prisma.event.create({
        data: {
          title,
          description: `${title} : un événement ${category.name.toLowerCase()} organisé à ${place.city}. Venez nombreux, le programme détaillé sera communiqué aux inscrits.`,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3 * 60 * 60 * 1000),
          venue,
          address,
          city: place.city,
          capacity,
          priceCents: [0, 1200, 2500, 0, 4500][index % 5],
          categoryId: category.id,
          organizerId: organizers[index % organizers.length].id,
        },
      });
      await prisma.registration.createMany({
        data: participants
          .slice(0, registrations)
          .map((p) => ({ eventId: event.id, userId: p.id })),
      });
      index += 1;
    }
  }

  // Un événement passé : absent du catalogue par défaut, visible dans « Mes inscriptions ».
  const pastEvent = await prisma.event.create({
    data: {
      title: 'Édition précédente du meetup',
      description: 'Événement passé, conservé pour vérifier le filtre par défaut.',
      startsAt: daysFromNow(-10, 19),
      venue: 'Station F',
      city: 'Paris',
      capacity: 50,
      categoryId: createdCategories.at(-1)!.id,
      organizerId: organizers[0].id,
    },
  });
  await prisma.registration.createMany({
    data: participants.slice(0, 5).map((p) => ({ eventId: pastEvent.id, userId: p.id })),
  });

  console.log(`Seed terminé : ${index + 1} événements, ${createdCategories.length} catégories.`);
  console.log(
    `Comptes de démo (mot de passe « ${DEMO_PASSWORD} ») : camille@eventhub.test (organisateur), participant1@eventhub.test (participant).`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
