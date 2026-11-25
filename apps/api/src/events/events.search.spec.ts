import { resolvePeriod, toSearchQuery } from './events.search.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

describe('resolvePeriod', () => {
  it('ne retourne que les événements à venir par défaut', () => {
    expect(resolvePeriod({}, NOW)).toEqual({ gte: NOW });
  });

  it('ramène un `from` passé à maintenant (#46)', () => {
    expect(resolvePeriod({ from: '2020-01-01' }, NOW)).toEqual({ gte: NOW });
  });

  it('ramène à maintenant un `from` du jour même déjà écoulé', () => {
    expect(resolvePeriod({ from: '2026-11-20' }, NOW)).toEqual({ gte: NOW });
  });

  it('conserve un `from` futur', () => {
    expect(resolvePeriod({ from: '2026-12-01T18:00:00Z' }, NOW)).toEqual({
      gte: new Date('2026-12-01T18:00:00Z'),
    });
  });

  it('inclut toute la journée quand `to` est une date seule', () => {
    expect(resolvePeriod({ from: '2026-12-01', to: '2026-12-31' }, NOW)).toEqual({
      gte: new Date('2026-12-01T00:00:00.000Z'),
      lt: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('utilise une borne incluse quand `to` est une date-heure', () => {
    expect(resolvePeriod({ to: '2026-12-31T12:00:00Z' }, NOW)).toEqual({
      gte: NOW,
      lte: new Date('2026-12-31T12:00:00Z'),
    });
  });
});

describe('toSearchQuery', () => {
  it.each([
    ['jazz', 'jazz:*'],
    ['  Soirée   jazz ', 'Soirée:* & jazz:*'],
    ["l'œuvre", 'l:* & œuvre:*'],
    ['Node.js', 'Node:* & js:*'],
    ['rendez-vous', 'rendez:* & vous:*'],
    ['3x3', '3x3:*'],
    // É décomposé (e + accent combinant) : recomposé, sinon le mot serait coupé en deux.
    ['E\u0301te\u0301', 'Été:*'],
  ])('« %s » devient %s', (q, expected) => {
    expect(toSearchQuery(q)).toBe(expected);
  });

  it.each(['!', '&', '|', '<->', "'", ':*', '\\', '(', ''])(
    'ignore une saisie sans lettre ni chiffre : « %s »',
    (q) => expect(toSearchQuery(q)).toBeUndefined(),
  );

  it('ne laisse passer aucun opérateur de to_tsquery', () => {
    expect(toSearchQuery("jazz | !rock & (a <-> b):*'")).toBe('jazz:* & rock:* & a:* & b:*');
  });

  it('accepte une recherche absente', () => {
    expect(toSearchQuery(undefined)).toBeUndefined();
  });
});
