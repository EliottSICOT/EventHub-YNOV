import { createOpenApiHttp } from 'openapi-msw';
import type { paths } from '../api/schema';
import type { EventDetail, EventSummary, FieldError } from '../api/types';
import { mockAuth } from './auth';
import { categories as defaultCategories, events as defaultEvents } from './fixtures';
import { mockRegistrations } from './registrations';

const http = createOpenApiHttp<paths>({ baseUrl: '*' });

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 24 * 60 * 60 * 1000;

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
  return [
    http.get('/api/v1/events', ({ query, request, response }) => {
      const page = Number(query.get('page') ?? 1);
      const pageSize = Number(query.get('pageSize') ?? 12);
      const from = query.get('from');
      const to = query.get('to');
      const category = query.get('category');
      const city = query.get('city')?.toLowerCase();

      const fromTime = from ? new Date(from).getTime() : Date.now();
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

      const matching = events
        .filter((e) => {
          const start = new Date(e.startsAt).getTime();
          return (
            start >= fromTime &&
            start < toTime &&
            (!category || e.category.slug === category) &&
            (!city || e.city.toLowerCase().includes(city))
          );
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

      return response(200).json({
        data: matching
          .slice((page - 1) * pageSize, page * pageSize)
          .map((e) => withRegistrations(toSummary(e))),
        meta: {
          page,
          pageSize,
          total: matching.length,
          totalPages: Math.ceil(matching.length / pageSize),
        },
      });
    }),

    http.get('/api/v1/events/{id}', ({ params, request, response }) => {
      const event = events.find((e) => e.id === params.id);
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
      const event = events.find((e) => e.id === params.id);
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
          const event = events.find((e) => e.id === registration.eventId);
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
      const event = events.find((e) => e.id === registration.eventId);
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

    ...authHandlers,
  ];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
