import { AUTH_MESSAGES } from '../auth/auth.constants.js';
import type { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { EVENT_NOT_FOUND_MESSAGE } from '../events/events.service.js';
import type { RegistrationDto } from './dto/registration.dto.js';
import type { UserRegistrationDto } from './dto/user-registration.dto.js';
import { REGISTRATION_MESSAGES } from './registrations.constants.js';

/** Exemples du contrat OpenAPI des routes d'inscription (US05, US06). */

const EVENT_ID = '3f0c1a52-6a3e-4b8e-9a43-0d7f1e2b9c11';
const PATH = `/api/v1/events/${EVENT_ID}/registrations`;
const TIMESTAMP = '2026-11-20T10:33:21.774Z';

function error(
  statusCode: number,
  label: string,
  message: string,
  path: string = PATH,
): ApiErrorDto {
  return { statusCode, error: label, message, path, timestamp: TIMESTAMP };
}

export const registrationExample: RegistrationDto = {
  id: '9b1d2c3e-4f5a-4b6c-8d7e-0a1b2c3d4e5f',
  eventId: EVENT_ID,
  createdAt: TIMESTAMP,
  remainingSeats: 41,
  isFull: false,
};

export const unauthenticatedExample = error(401, 'Unauthorized', AUTH_MESSAGES.unauthenticated);
export const eventNotFoundExample = error(404, 'Not Found', EVENT_NOT_FOUND_MESSAGE);
export const alreadyRegisteredExample = error(
  409,
  'Conflict',
  REGISTRATION_MESSAGES.alreadyRegistered,
);

const REGISTRATION_ID = '9b1d2c3e-4f5a-4b6c-8d7e-0a1b2c3d4e5f';
const CANCEL_PATH = `/api/v1/registrations/${REGISTRATION_ID}`;

export const userRegistrationsExample: UserRegistrationDto[] = [
  {
    id: REGISTRATION_ID,
    createdAt: TIMESTAMP,
    event: {
      id: EVENT_ID,
      title: 'Nuit du jazz',
      startsAt: '2026-12-05T18:00:00.000Z',
      endsAt: '2026-12-05T21:00:00.000Z',
      venue: 'Le Transbordeur',
      city: 'Lyon',
      capacity: 300,
      priceCents: 1500,
      remainingSeats: 41,
      isFull: false,
      isCancelled: false,
      imageUrl: null,
      category: { id: '5d1f0c52-6a3e-4b8e-9a43-0d7f1e2b9c22', name: 'Concert', slug: 'concert' },
    },
  },
];

export const unauthenticatedListExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  '/api/v1/registrations/me',
);
export const unauthenticatedCancelExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  CANCEL_PATH,
);
export const notOwnerExample = error(403, 'Forbidden', REGISTRATION_MESSAGES.notOwner, CANCEL_PATH);
export const notFoundExample = error(404, 'Not Found', REGISTRATION_MESSAGES.notFound, CANCEL_PATH);
export const cancelPastExample = error(
  409,
  'Conflict',
  REGISTRATION_MESSAGES.cancelPast,
  CANCEL_PATH,
);
