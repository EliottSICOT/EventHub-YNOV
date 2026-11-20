import { createOpenApiHttp } from 'openapi-msw';
import type { paths } from '../api/schema';
import type { EventDetail, EventSummary } from '../api/types';
import { categories as defaultCategories, events as defaultEvents } from './fixtures';

const http = createOpenApiHttp<paths>({ baseUrl: '*' });

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 24 * 60 * 60 * 1000;

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
        data: matching.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
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
      return response(200).json(event);
    }),

    http.get('/api/v1/categories', ({ response }) => response(200).json(categories)),
  ];
}

export const handlers = createHandlers();
