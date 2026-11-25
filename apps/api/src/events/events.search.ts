import { Prisma } from '../generated/prisma/client.js';
import {
  EVENT_SORTS,
  type EventSort,
  type ListEventsQueryDto,
} from './dto/list-events-query.dto.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface Period {
  gte: Date;
  lt?: Date;
  lte?: Date;
}

/** Période du catalogue, jamais dans le passé : un `from` antérieur à maintenant est ignoré. */
export function resolvePeriod(query: Pick<ListEventsQueryDto, 'from' | 'to'>, now: Date): Period {
  const from = query.from ? new Date(query.from) : now;
  const period: Period = { gte: from.getTime() > now.getTime() ? from : now };
  if (query.to) {
    if (DATE_ONLY.test(query.to)) {
      // Une date seule (YYYY-MM-DD) inclut toute la journée.
      period.lt = new Date(new Date(query.to).getTime() + ONE_DAY_MS);
    } else {
      period.lte = new Date(query.to);
    }
  }
  return period;
}

/**
 * Mots saisis vers une requête plein texte : tous doivent être présents, chacun pouvant être
 * le début d'un mot (« jaz » trouve « jazz », pour chercher pendant la frappe).
 * Seuls des lettres et des chiffres sont gardés : aucun opérateur de `to_tsquery` ne passe.
 * `undefined` s'il n'y a aucun mot.
 */
export function toSearchQuery(q: string | undefined): string | undefined {
  const words = q?.normalize('NFC').match(/[\p{L}\p{N}]+/gu);
  return words?.map((word) => `${word}:*`).join(' & ');
}

/** Échappe les jokers de LIKE : « 100% » cherche bien le caractère « % ». */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Même expression que l'index `events_search_idx` (migration `add_event_search`). */
export const SEARCH_VECTOR = Prisma.sql`to_tsvector('public.eventhub_search'::regconfig, translate(e.title || ' ' || e.description, './:@_-', '      '))`;

const REMAINING_SEATS = Prisma.sql`GREATEST(0, e.capacity - (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id))`;

/** Tris du catalogue. À égalité, l'événement le plus proche d'abord. */
const ORDER_BY: Record<EventSort, Prisma.Sql> = {
  date: Prisma.sql`e.starts_at ASC, e.id ASC`,
  '-date': Prisma.sql`e.starts_at DESC, e.id ASC`,
  price: Prisma.sql`e.price_cents ASC, e.starts_at ASC, e.id ASC`,
  '-price': Prisma.sql`e.price_cents DESC, e.starts_at ASC, e.id ASC`,
  seats: Prisma.sql`${REMAINING_SEATS} ASC, e.starts_at ASC, e.id ASC`,
  '-seats': Prisma.sql`${REMAINING_SEATS} DESC, e.starts_at ASC, e.id ASC`,
};

/** Filtres (US02) et recherche (US10) du catalogue, combinés. */
function catalogueWhere(query: ListEventsQueryDto, now: Date): Prisma.Sql {
  const { gte, lt, lte } = resolvePeriod(query, now);
  const conditions = [
    Prisma.sql`e.starts_at >= ${gte}`,
    // Un événement supprimé par son organisateur (US09) sort du catalogue.
    Prisma.sql`e.cancelled_at IS NULL`,
  ];
  if (lt) conditions.push(Prisma.sql`e.starts_at < ${lt}`);
  if (lte) conditions.push(Prisma.sql`e.starts_at <= ${lte}`);
  if (query.category) {
    conditions.push(
      Prisma.sql`e.category_id IN (SELECT c.id FROM categories c WHERE c.slug = ${query.category})`,
    );
  }
  if (query.city) {
    conditions.push(Prisma.sql`e.city ILIKE ${`%${escapeLike(query.city)}%`}`);
  }
  const search = toSearchQuery(query.q);
  if (search) {
    conditions.push(
      Prisma.sql`${SEARCH_VECTOR} @@ to_tsquery('public.eventhub_search'::regconfig, ${search})`,
    );
  }
  return Prisma.join(conditions, ' AND ');
}

/**
 * Identifiants des événements d'une page du catalogue, triés. En SQL : Prisma ne sait ni trier
 * par places restantes, ni interroger une configuration plein texte qui ignore les accents.
 */
export function cataloguePageSql(query: ListEventsQueryDto, now: Date): Prisma.Sql {
  const { page, pageSize, sort = EVENT_SORTS[0] } = query;
  return Prisma.sql`
    SELECT e.id FROM events e
    WHERE ${catalogueWhere(query, now)}
    ORDER BY ${ORDER_BY[sort]}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
}

export function catalogueCountSql(query: ListEventsQueryDto, now: Date): Prisma.Sql {
  return Prisma.sql`SELECT COUNT(*)::int AS total FROM events e WHERE ${catalogueWhere(query, now)}`;
}
