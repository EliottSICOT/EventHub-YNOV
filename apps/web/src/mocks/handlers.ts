import { createOpenApiHttp } from 'openapi-msw';
import type { paths } from '../api/schema';
import type {
  Category,
  EventDetail,
  EventSort,
  EventSummary,
  FieldError,
  User,
} from '../api/types';
import { mockAuth } from './auth';
import { mockEvents } from './events';
import { categories as defaultCategories, events as defaultEvents } from './fixtures';
import { mockRegistrations } from './registrations';
import { mockRegistrationsCsv } from './registrationsCsv';

const http = createOpenApiHttp<paths>({ baseUrl: '*' });

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 24 * 60 * 60 * 1000;

/** Mots d'un texte, sans majuscules ni accents, comme la recherche de l'API (US10). */
function words(text: string): string[] {
  return (
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/œ/g, 'oe')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/** Tous les mots de `q` sont le début d'un mot du titre ou de la description. */
function matchesSearch(event: EventDetail, q: string): boolean {
  const text = words(`${event.title} ${event.description}`);
  return words(q).every((word) => text.some((candidate) => candidate.startsWith(word)));
}

/** Tris de l'API ; à égalité, l'événement le plus proche d'abord. */
function compareBy(sort: EventSort) {
  const key = {
    date: (e: EventSummary) => Date.parse(e.startsAt),
    price: (e: EventSummary) => e.priceCents,
    seats: (e: EventSummary) => e.remainingSeats,
  }[sort.replace('-', '') as 'date' | 'price' | 'seats'];
  const direction = sort.startsWith('-') ? -1 : 1;
  return (a: EventSummary, b: EventSummary) =>
    direction * (key(a) - key(b)) || a.startsAt.localeCompare(b.startsAt);
}

/** Applique les inscriptions simulées (US05) aux places restantes d'une fixture. */
function withRegistrations<T extends { id: string; remainingSeats: number; isFull: boolean }>(
  event: T,
): T {
  const remainingSeats = Math.max(0, event.remainingSeats - mockRegistrations.count(event.id));
  return { ...event, remainingSeats, isFull: remainingSeats === 0 };
}

function toSummary(event: EventDetail): EventSummary {
  const { description: _d, address: _a, organizer: _o, ...summary } = event;
  return summary;
}

function errorBody(statusCode: number, error: string, message: string, path: string) {
  return { statusCode, error, message, path, timestamp: new Date().toISOString() };
}

/**
 * Handlers MSW typés par le contrat OpenAPI : un chemin, un paramètre ou une réponse
 * absents de openapi.json ne compilent pas. Ils reproduisent le comportement de l'API
 * (filtres, pagination, 404) pour que le Front puisse avancer sans le Back.
 */
export function createHandlers(events = defaultEvents, categories = defaultCategories) {
  // Fixtures, plus les événements créés (US08) ou modifiés (US09) pendant la session.
  const allEvents = () =>
    [...events, ...mockEvents.all()].map((event) => mockEvents.withChanges(event));

  return [
    http.get('/api/v1/events', ({ query, request, response }) => {
      const page = Number(query.get('page') ?? 1);
      const pageSize = Number(query.get('pageSize') ?? 12);
      const from = query.get('from');
      const to = query.get('to');
      const category = query.get('category');
      const city = query.get('city')?.toLowerCase();
      const q = query.get('q') ?? '';
      const sort = query.get('sort') ?? 'date';

      // Comme l'API : un `from` passé est ramené à maintenant, jamais d'événement passé.
      const now = Date.now();
      const fromTime = Math.max(from ? new Date(from).getTime() : now, now);
      const toTime = to ? new Date(to).getTime() + (DATE_ONLY.test(to) ? DAY : 1) : Infinity;

      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
        return response(400).json({
          ...errorBody(
            400,
            'Bad Request',
            'La requête contient des champs invalides',
            new URL(request.url).pathname,
          ),
          details: [{ field: 'pageSize', message: 'pageSize doit être inférieur ou égal à 50' }],
        });
      }

      const matching = allEvents()
        .filter((e) => {
          const start = new Date(e.startsAt).getTime();
          return (
            !e.isCancelled &&
            start >= fromTime &&
            start < toTime &&
            (!category || e.category.slug === category) &&
            (!city || e.city.toLowerCase().includes(city)) &&
            matchesSearch(e, q)
          );
        })
        .map((e) => withRegistrations(toSummary(e)))
        .sort(compareBy(sort));

      return response(200).json({
        data: matching.slice((page - 1) * pageSize, page * pageSize),
        meta: {
          page,
          pageSize,
          total: matching.length,
          totalPages: Math.ceil(matching.length / pageSize),
        },
      });
    }),

    http.get('/api/v1/events/{id}', ({ params, request, response }) => {
      const event = allEvents().find((e) => e.id === params.id);
      if (!event) {
        return response(404).json(
          errorBody(
            404,
            'Not Found',
            "L'événement demandé n'existe pas",
            new URL(request.url).pathname,
          ),
        );
      }
      return response(200).json(withRegistrations(event));
    }),

    http.post('/api/v1/events/{id}/registrations', ({ params, request, response }) => {
      const path = new URL(request.url).pathname;
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(errorBody(401, 'Unauthorized', 'Authentification requise', path));
      }
      const event = allEvents().find((e) => e.id === params.id);
      if (!event) {
        return response(404).json(
          errorBody(404, 'Not Found', "L'événement demandé n'existe pas", path),
        );
      }
      const conflict = (message: string) =>
        response(409).json(errorBody(409, 'Conflict', message, path));

      if (mockRegistrations.has(event.id, user.id)) {
        return conflict('Vous êtes déjà inscrit à cet événement');
      }
      if (event.isCancelled) return conflict('Cet événement est annulé');
      if (new Date(event.startsAt).getTime() <= Date.now()) {
        return conflict('Cet événement est déjà passé');
      }
      if (withRegistrations(event).isFull) return conflict('Cet événement est complet');

      const registration = mockRegistrations.add(event.id, user.id);
      const { remainingSeats, isFull } = withRegistrations(event);
      return response(201).json({
        id: registration.id,
        eventId: event.id,
        createdAt: registration.createdAt,
        remainingSeats,
        isFull,
      });
    }),

    // US06 : mes inscriptions, passées comprises, de l'événement le plus proche au plus lointain.
    http.get('/api/v1/registrations/me', ({ request, response }) => {
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(
          errorBody(401, 'Unauthorized', 'Authentification requise', new URL(request.url).pathname),
        );
      }
      const mine = mockRegistrations
        .forUser(user.id)
        .flatMap((registration) => {
          const event = allEvents().find((e) => e.id === registration.eventId);
          return event
            ? [{ id: registration.id, createdAt: registration.createdAt, event: toSummary(event) }]
            : [];
        })
        .map((item) => ({ ...item, event: withRegistrations(item.event) }))
        .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
      return response(200).json(mine);
    }),

    // US06 : annulation réservée au propriétaire (403), refusée pour un événement passé (409).
    http.delete('/api/v1/registrations/{id}', ({ params, request, response }) => {
      const path = new URL(request.url).pathname;
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(errorBody(401, 'Unauthorized', 'Authentification requise', path));
      }
      const registration = mockRegistrations.find(params.id);
      if (!registration) {
        return response(404).json(
          errorBody(404, 'Not Found', "L'inscription demandée n'existe pas", path),
        );
      }
      if (registration.userId !== user.id) {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Vous ne pouvez pas annuler l'inscription d'un autre participant",
            path,
          ),
        );
      }
      const event = allEvents().find((e) => e.id === registration.eventId);
      if (event?.isCancelled) {
        return response(409).json(
          errorBody(
            409,
            'Conflict',
            "Impossible d'annuler l'inscription à un événement annulé",
            path,
          ),
        );
      }
      if (event && new Date(event.startsAt).getTime() <= Date.now()) {
        return response(409).json(
          errorBody(
            409,
            'Conflict',
            "Impossible d'annuler l'inscription à un événement passé",
            path,
          ),
        );
      }
      mockRegistrations.remove(registration.id);
      return response(204).empty();
    }),

    http.get('/api/v1/categories', ({ response }) => response(200).json(categories)),

    // US08 : création réservée aux organisateurs, mêmes règles et mêmes messages que l'API.
    http.post('/api/v1/events', async ({ request, response }) => {
      const path = new URL(request.url).pathname;
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(errorBody(401, 'Unauthorized', 'Authentification requise', path));
      }
      if (user.role !== 'ORGANIZER') {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Vous n'avez pas les droits nécessaires pour cette action",
            path,
          ),
        );
      }
      const body = (await request.json()) as Record<string, unknown>;
      const details = validateCreateEvent(body);
      if (details.length > 0) return response(400).json(validationError(path, details));

      const category = categories.find((c) => c.id === body.categoryId);
      if (!category) {
        return response(400).json(
          validationError(path, [
            { field: 'categoryId', message: "La catégorie choisie n'existe pas" },
          ]),
        );
      }
      const event = buildCreatedEvent(body, category, user);
      mockEvents.add(event);
      return response(201).json(event);
    }),

    // US08 : image réservée à l'organisateur de l'événement, JPG ou PNG, 2 Mo maximum.
    http.post('/api/v1/events/{id}/image', async ({ params, request, response }) => {
      const path = new URL(request.url).pathname;
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(errorBody(401, 'Unauthorized', 'Authentification requise', path));
      }
      const event = allEvents().find((e) => e.id === params.id);
      if (!event) {
        return response(404).json(
          errorBody(404, 'Not Found', "L'événement demandé n'existe pas", path),
        );
      }
      if (event.organizer.id !== user.id) {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Seul l'organisateur de l'événement peut modifier son image",
            path,
          ),
        );
      }
      const image = (await request.formData()).get('image');
      const message = imageError(image);
      if (message || !isFile(image)) {
        return response(400).json(
          validationError(path, [{ field: 'image', message: message ?? '' }]),
        );
      }
      // En dev:mock, l'image choisie s'affiche vraiment ; sinon, une URL comme celles de l'API.
      const imageUrl =
        typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(image)
          : `/uploads/${crypto.randomUUID()}.${image.type === 'image/png' ? 'png' : 'jpg'}`;
      const updated = mockEvents.update(event, { imageUrl });
      return response(200).json(withRegistrations(updated));
    }),

    // US09 : modification et suppression réservées à l'organisateur de l'événement.
    http.put('/api/v1/events/{id}', async ({ params, request, response }) => {
      const path = new URL(request.url).pathname;
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(errorBody(401, 'Unauthorized', 'Authentification requise', path));
      }
      if (user.role !== 'ORGANIZER') {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Vous n'avez pas les droits nécessaires pour cette action",
            path,
          ),
        );
      }
      const event = allEvents().find((e) => e.id === params.id);
      if (!event) {
        return response(404).json(
          errorBody(404, 'Not Found', "L'événement demandé n'existe pas", path),
        );
      }
      if (event.organizer.id !== user.id) {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Seul l'organisateur de l'événement peut le modifier ou le supprimer",
            path,
          ),
        );
      }
      const conflict = manageConflict(event);
      if (conflict) return response(409).json(errorBody(409, 'Conflict', conflict, path));
      const body = (await request.json()) as Record<string, unknown>;
      const details = validateCreateEvent(body);
      const category = categories.find((c) => c.id === body.categoryId);
      if (details.length === 0 && !category) {
        details.push({ field: 'categoryId', message: "La catégorie choisie n'existe pas" });
      }
      const registered = event.capacity - withRegistrations(event).remainingSeats;
      if (details.length === 0 && (body.capacity as number) < registered) {
        details.push({
          field: 'capacity',
          message: `La capacité ne peut pas être inférieure au nombre d'inscrits (${registered})`,
        });
      }
      if (details.length > 0 || !category) {
        return response(400).json(validationError(path, details));
      }
      const fields = buildEventFields(body, category);
      const updated = mockEvents.update(event, {
        ...fields,
        // Places restantes de la fixture, avant les inscriptions simulées.
        remainingSeats: fields.capacity - (event.capacity - event.remainingSeats),
      });
      return response(200).json(withRegistrations(updated));
    }),

    http.delete('/api/v1/events/{id}', ({ params, request, response }) => {
      const path = new URL(request.url).pathname;
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(errorBody(401, 'Unauthorized', 'Authentification requise', path));
      }
      if (user.role !== 'ORGANIZER') {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Vous n'avez pas les droits nécessaires pour cette action",
            path,
          ),
        );
      }
      const event = allEvents().find((e) => e.id === params.id);
      if (!event) {
        return response(404).json(
          errorBody(404, 'Not Found', "L'événement demandé n'existe pas", path),
        );
      }
      if (event.organizer.id !== user.id) {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Seul l'organisateur de l'événement peut le modifier ou le supprimer",
            path,
          ),
        );
      }
      const conflict = manageConflict(event);
      if (conflict) return response(409).json(errorBody(409, 'Conflict', conflict, path));
      mockEvents.update(event, { isCancelled: true });
      return response(204).empty();
    }),

    // US13 : export CSV des inscrits simulés, réservé à l'organisateur de l'événement.
    http.get('/api/v1/events/{id}/registrations.csv', ({ params, request, response }) => {
      const path = new URL(request.url).pathname;
      const user = mockAuth.currentUser;
      if (!user) {
        return response(401).json(errorBody(401, 'Unauthorized', 'Authentification requise', path));
      }
      if (user.role !== 'ORGANIZER') {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Vous n'avez pas les droits nécessaires pour cette action",
            path,
          ),
        );
      }
      const event = allEvents().find((e) => e.id === params.id);
      if (!event) {
        return response(404).json(
          errorBody(404, 'Not Found', "L'événement demandé n'existe pas", path),
        );
      }
      if (event.organizer.id !== user.id) {
        return response(403).json(
          errorBody(
            403,
            'Forbidden',
            "Seul l'organisateur de l'événement peut exporter la liste de ses inscrits",
            path,
          ),
        );
      }
      const rows = mockRegistrations.forEvent(event.id).flatMap(({ userId, createdAt }) => {
        const person = mockAuth.findById(userId);
        return person ? [{ ...person, createdAt }] : [];
      });
      const csv = mockRegistrationsCsv(event, rows);
      return response(200).text(csv.content, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': csv.contentDisposition,
        },
      });
    }),

    ...authHandlers,
  ];
}

/** Raison pour laquelle un événement ne peut plus être modifié ni supprimé (US09). */
function manageConflict(event: EventDetail): string | undefined {
  if (event.isCancelled) return 'Cet événement est annulé';
  if (new Date(event.startsAt).getTime() <= Date.now())
    return 'Impossible de modifier ou de supprimer un événement qui a déjà commencé';
  return undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const CREATE_EVENT_FIELDS = new Set([
  'title',
  'description',
  'categoryId',
  'startsAt',
  'endsAt',
  'venue',
  'address',
  'city',
  'capacity',
  'priceCents',
]);

/**
 * Champ fichier d'un multipart. Pas de `instanceof File` : dans les tests (jsdom), le fichier
 * décodé par le `fetch` de Node n'est pas une instance du `File` global de jsdom.
 */
function isFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== 'string';
}

/** Contrôle de l'image comme l'API (le mock se fie au type annoncé, l'API lit le contenu). */
function imageError(image: FormDataEntryValue | null): string | undefined {
  if (!isFile(image) || image.size === 0) return "L'image est obligatoire";
  if (!IMAGE_TYPES.includes(image.type)) return "L'image doit être au format JPG ou PNG";
  if (image.size > MAX_IMAGE_BYTES) return "L'image ne doit pas dépasser 2 Mo";
  return undefined;
}

/** Règles de `CreateEventDto` côté API (US08), avec les mêmes messages. */
function validateCreateEvent(body: Record<string, unknown>): FieldError[] {
  const details: FieldError[] = [];
  const add = (field: string, message: string) => details.push({ field, message });
  const text = (field: string) => asString(body[field]).trim();

  for (const field of Object.keys(body)) {
    if (!CREATE_EVENT_FIELDS.has(field)) add(field, `property ${field} should not exist`);
  }
  const title = text('title');
  if (!title) add('title', 'Le titre est obligatoire');
  else if (title.length < 3) add('title', 'Le titre doit contenir au moins 3 caractères');
  else if (title.length > 120) add('title', 'Le titre ne doit pas dépasser 120 caractères');
  const description = text('description');
  if (!description) add('description', 'La description est obligatoire');
  else if (description.length > 5000)
    add('description', 'La description ne doit pas dépasser 5000 caractères');
  if (!text('categoryId')) add('categoryId', 'La catégorie est obligatoire');

  const startsAt = Date.parse(asString(body.startsAt));
  if (!body.startsAt) add('startsAt', 'La date de début est obligatoire');
  else if (Number.isNaN(startsAt))
    add('startsAt', 'La date de début doit être une date-heure ISO 8601 valide');
  else if (startsAt <= Date.now()) add('startsAt', 'La date de début doit être dans le futur');
  if (body.endsAt !== undefined) {
    const endsAt = Date.parse(asString(body.endsAt));
    if (Number.isNaN(endsAt))
      add('endsAt', 'La date de fin doit être une date-heure ISO 8601 valide');
    else if (!Number.isNaN(startsAt) && endsAt <= startsAt)
      add('endsAt', 'La date de fin doit être postérieure à la date de début');
  }

  if (!text('venue')) add('venue', 'Le lieu est obligatoire');
  if (!text('city')) add('city', 'La ville est obligatoire');

  const { capacity, priceCents } = body;
  if (typeof capacity !== 'number' || !Number.isInteger(capacity))
    add('capacity', 'La capacité doit être un nombre entier');
  else if (capacity < 1) add('capacity', "La capacité doit être d'au moins 1 place");
  else if (capacity > 100_000) add('capacity', 'La capacité ne doit pas dépasser 100 000 places');
  if (typeof priceCents !== 'number' || !Number.isInteger(priceCents))
    add('priceCents', 'Le prix doit être un nombre entier de centimes');
  else if (priceCents < 0) add('priceCents', 'Le prix doit être positif ou nul');
  else if (priceCents > 1_000_000) add('priceCents', 'Le prix ne doit pas dépasser 10 000 €');
  return details;
}

/** Champs modifiables d'un événement, à partir d'un corps déjà validé. */
function buildEventFields(body: Record<string, unknown>, category: Category) {
  return {
    title: asString(body.title).trim(),
    description: asString(body.description).trim(),
    startsAt: new Date(asString(body.startsAt)).toISOString(),
    endsAt: body.endsAt ? new Date(asString(body.endsAt)).toISOString() : null,
    venue: asString(body.venue).trim(),
    address: asString(body.address).trim() || null,
    city: asString(body.city).trim(),
    capacity: body.capacity as number,
    priceCents: body.priceCents as number,
    category,
  };
}

function buildCreatedEvent(
  body: Record<string, unknown>,
  category: Category,
  user: User,
): EventDetail {
  const fields = buildEventFields(body, category);
  return {
    ...fields,
    id: crypto.randomUUID(),
    remainingSeats: fields.capacity,
    isFull: false,
    isCancelled: false,
    imageUrl: null,
    organizer: { id: user.id, name: `${user.firstName} ${user.lastName}` },
  };
}

function validationError(path: string, details: FieldError[]) {
  return {
    ...errorBody(400, 'Bad Request', 'La requête contient des champs invalides', path),
    details,
  };
}

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

/** Authentification (US04) : mêmes règles et mêmes messages que l'API, session dans `mockAuth`. */
const authHandlers = [
  http.post('/api/v1/auth/sign-up', async ({ request, response }) => {
    const path = new URL(request.url).pathname;
    const body = (await request.json()) as Record<string, unknown>;
    const input = {
      firstName: asString(body.firstName).trim(),
      lastName: asString(body.lastName).trim(),
      email: asString(body.email).trim().toLowerCase(),
      password: asString(body.password),
    };

    const details: FieldError[] = [];
    if (!input.firstName)
      details.push({ field: 'firstName', message: 'Le prénom est obligatoire' });
    if (!input.lastName) details.push({ field: 'lastName', message: 'Le nom est obligatoire' });
    if (!EMAIL.test(input.email))
      details.push({ field: 'email', message: "L'email n'est pas valide" });
    if (input.password.length < 8) {
      details.push({
        field: 'password',
        message: 'Le mot de passe doit contenir au moins 8 caractères',
      });
    }
    if (details.length > 0) return response(400).json(validationError(path, details));

    if (mockAuth.findByEmail(input.email)) {
      return response(409).json(
        errorBody(409, 'Conflict', 'Un compte existe déjà avec cet email', path),
      );
    }
    return response(201).json(mockAuth.create(input));
  }),

  http.post('/api/v1/auth/sign-in', async ({ request, response }) => {
    const path = new URL(request.url).pathname;
    const body = (await request.json()) as Record<string, unknown>;
    const email = asString(body.email).trim().toLowerCase();
    const password = asString(body.password);

    const details: FieldError[] = [];
    if (!email) details.push({ field: 'email', message: "L'email est obligatoire" });
    if (!password) details.push({ field: 'password', message: 'Le mot de passe est obligatoire' });
    if (details.length > 0) return response(400).json(validationError(path, details));

    const account = mockAuth.findByEmail(email);
    if (!account || account.password !== password) {
      return response(401).json(
        errorBody(401, 'Unauthorized', 'Email ou mot de passe incorrect', path),
      );
    }
    mockAuth.signIn(email);
    return response(200).json(account.user);
  }),

  http.post('/api/v1/auth/sign-out', ({ response }) => {
    mockAuth.signOut();
    return response(204).empty();
  }),

  http.get('/api/v1/auth/me', ({ request, response }) => {
    const user = mockAuth.currentUser;
    if (!user) {
      return response(401).json(
        errorBody(401, 'Unauthorized', 'Authentification requise', new URL(request.url).pathname),
      );
    }
    return response(200).json(user);
  }),
];

export const handlers = createHandlers();
