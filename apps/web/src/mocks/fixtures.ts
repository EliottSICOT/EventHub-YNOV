import type { Category, EventDetail } from '../api/types';

/** Jeu de données des mocks : mêmes formes que les réponses de l'API (types générés depuis openapi.json). */
export const categories: Category[] = [
  { id: 'cat-atelier', name: 'Atelier', slug: 'atelier' },
  { id: 'cat-concert', name: 'Concert', slug: 'concert' },
  { id: 'cat-conference', name: 'Conférence', slug: 'conference' },
  { id: 'cat-meetup', name: 'Meetup tech', slug: 'meetup-tech' },
  { id: 'cat-sport', name: 'Sport', slug: 'sport' },
];

const organizers = [
  { id: 'org-1', name: 'Camille Martin' },
  { id: 'org-2', name: 'Yanis Bernard' },
];

const places = [
  { venue: 'Le Transbordeur', address: '3 boulevard de Stalingrad', city: 'Lyon' },
  { venue: 'Station F', address: '5 parvis Alan Turing', city: 'Paris' },
  { venue: 'Darwin', address: '87 quai des Queyries', city: 'Bordeaux' },
  { venue: 'Stereolux', address: '4 boulevard Léon Bureau', city: 'Nantes' },
];

const titles = [
  'Nuit du jazz',
  'Meetup TypeScript',
  'Atelier céramique',
  'Course des quais',
  'Sommet IA & société',
  'Festival électro',
  'React & performances',
  'Initiation à la photo',
  'Tournoi de basket 3x3',
  'Conférence climat',
  'Rock en plein air',
  'Postgres en production',
  'Atelier cuisine du monde',
  'Yoga au parc',
  'Futur du travail',
];
const categoryOf = ['concert', 'meetup-tech', 'atelier', 'sport', 'conference'];

const DAY = 24 * 60 * 60 * 1000;

function buildEvent(index: number, now: number): EventDetail {
  const category = categories.find((c) => c.slug === categoryOf[index % categoryOf.length])!;
  const place = places[index % places.length];
  const start = new Date(now + (2 + index * 3) * DAY);
  start.setUTCHours(18, 0, 0, 0);
  const capacity = [10, 40, 80, 150][index % 4];
  const remainingSeats = index % 5 === 0 ? 0 : Math.max(1, capacity - index * 9);

  return {
    id: `evt-${String(index + 1).padStart(2, '0')}`,
    title: titles[index],
    description: `${titles[index]} : un événement ${category.name.toLowerCase()} à ${place.city}. Le programme détaillé sera communiqué aux inscrits.`,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    ...place,
    capacity,
    priceCents: [0, 1200, 2500, 4500][index % 4],
    remainingSeats,
    isFull: remainingSeats === 0,
    imageUrl: null,
    category,
    organizer: organizers[index % organizers.length],
  };
}

export function createEvents(now = Date.now()): EventDetail[] {
  return titles.map((_, index) => buildEvent(index, now));
}

export const events = createEvents();
