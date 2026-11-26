import { AUTH_MESSAGES } from '../auth/auth.constants.js';
import type { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { VALIDATION_MESSAGE } from '../common/errors/validation.exception.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { EventDetailDto } from './dto/event-detail.dto.js';
import type { OrganizerEventDto } from './dto/organizer-event.dto.js';
import { IMAGE_MESSAGES } from './event-image.js';
import { CATEGORY_NOT_FOUND_MESSAGE, EVENT_NOT_FOUND_MESSAGE } from './events.service.js';

/** Exemples du contrat OpenAPI de la création d'un événement (US08) et du tableau de bord (US12). */

const EVENT_ID = '3f0c1a52-6a3e-4b8e-9a43-0d7f1e2b9c11';
const CATEGORY_ID = '5d1f0c52-6a3e-4b8e-9a43-0d7f1e2b9c22';
const CREATE_PATH = '/api/v1/events';
const MINE_PATH = '/api/v1/events/mine';
const IMAGE_PATH = `/api/v1/events/${EVENT_ID}/image`;
const TIMESTAMP = '2026-11-20T10:33:21.774Z';

function error(statusCode: number, label: string, message: string, path: string): ApiErrorDto {
  return { statusCode, error: label, message, path, timestamp: TIMESTAMP };
}

function validationError(path: string, details: ApiErrorDto['details']): ApiErrorDto {
  return {
    statusCode: 400,
    error: 'Bad Request',
    message: VALIDATION_MESSAGE,
    details,
    path,
    timestamp: TIMESTAMP,
  };
}

function eventDetail(imageUrl: string | null): EventDetailDto {
  return {
    id: EVENT_ID,
    title: 'Nuit du jazz',
    description: 'Trois quartets lyonnais se succèdent sur la scène du Transbordeur.',
    startsAt: '2026-12-05T18:00:00.000Z',
    endsAt: '2026-12-05T21:00:00.000Z',
    venue: 'Le Transbordeur',
    address: '3 boulevard de Stalingrad',
    city: 'Lyon',
    capacity: 300,
    priceCents: 1500,
    remainingSeats: 300,
    isFull: false,
    imageUrl,
    category: { id: CATEGORY_ID, name: 'Concert', slug: 'concert' },
    organizer: { id: '0d6a1b52-1b0e-4b8e-9a43-0d7f1e2b9c02', name: 'Camille Martin' },
  };
}

export const createEventExample: CreateEventDto = {
  title: 'Nuit du jazz',
  description: 'Trois quartets lyonnais se succèdent sur la scène du Transbordeur.',
  categoryId: CATEGORY_ID,
  startsAt: '2026-12-05T18:00:00.000Z',
  endsAt: '2026-12-05T21:00:00.000Z',
  venue: 'Le Transbordeur',
  address: '3 boulevard de Stalingrad',
  city: 'Lyon',
  capacity: 300,
  priceCents: 1500,
};

export const createdEventExample = eventDetail(null);

export const eventWithImageExample = eventDetail(
  '/uploads/7c9e6679-7425-40de-944b-e07fc1f90ae7.png',
);

export const createValidationErrorExample = validationError(CREATE_PATH, [
  { field: 'startsAt', message: 'La date de début doit être dans le futur' },
  { field: 'capacity', message: "La capacité doit être d'au moins 1 place" },
  { field: 'priceCents', message: 'Le prix doit être positif ou nul' },
]);

export const unknownCategoryExample = validationError(CREATE_PATH, [
  { field: 'categoryId', message: CATEGORY_NOT_FOUND_MESSAGE },
]);

export const createUnauthenticatedExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  CREATE_PATH,
);
export const createForbiddenExample = error(403, 'Forbidden', AUTH_MESSAGES.forbidden, CREATE_PATH);

export const imageFormatErrorExample = validationError(IMAGE_PATH, [
  { field: 'image', message: IMAGE_MESSAGES.format },
]);
export const imageTooLargeExample = validationError(IMAGE_PATH, [
  { field: 'image', message: IMAGE_MESSAGES.tooLarge },
]);
export const imageUnauthenticatedExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  IMAGE_PATH,
);
export const imageForbiddenExample = error(
  403,
  'Forbidden',
  IMAGE_MESSAGES.notOrganizer,
  IMAGE_PATH,
);
export const imageNotFoundExample = error(404, 'Not Found', EVENT_NOT_FOUND_MESSAGE, IMAGE_PATH);

export const organizerEventsExample: OrganizerEventDto[] = [
  {
    id: EVENT_ID,
    title: 'Nuit du jazz',
    startsAt: '2026-12-05T18:00:00.000Z',
    capacity: 300,
    registeredCount: 42,
    fillRate: 14,
  },
];

export const mineUnauthenticatedExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  MINE_PATH,
);
export const mineForbiddenExample = error(403, 'Forbidden', AUTH_MESSAGES.forbidden, MINE_PATH);
