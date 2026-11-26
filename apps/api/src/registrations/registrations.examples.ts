import { AUTH_MESSAGES } from '../auth/auth.constants.js';
import type { ApiErrorDto } from '../common/errors/api-error.dto.js';
import { EVENT_NOT_FOUND_MESSAGE } from '../events/events.service.js';
import type { EventRegistrantDto } from './dto/event-registrant.dto.js';
import type { RegistrationDto } from './dto/registration.dto.js';
import type { UserRegistrationDto } from './dto/user-registration.dto.js';
import type { UserWaitlistEntryDto } from './dto/user-waitlist-entry.dto.js';
import type { WaitlistEntryDto } from './dto/waitlist-entry.dto.js';
import { REGISTRATION_MESSAGES } from './registrations.constants.js';

/** Exemples du contrat OpenAPI des routes d'inscription (US05, US06, US12, US13, US14). */

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

export const eventRegistrantsExample: EventRegistrantDto[] = [
  {
    lastName: 'Dupont',
    firstName: 'Léa',
    email: 'lea.dupont@example.com',
    createdAt: '2026-11-20T09:15:00.000Z',
  },
  {
    lastName: 'Lefèvre',
    firstName: 'Éloïse',
    email: 'eloise.lefevre@example.com',
    createdAt: TIMESTAMP,
  },
];

export const listUnauthenticatedExample = error(401, 'Unauthorized', AUTH_MESSAGES.unauthenticated);
export const listNotOrganizerExample = error(
  403,
  'Forbidden',
  REGISTRATION_MESSAGES.listNotOrganizer,
);
export const listParticipantExample = error(403, 'Forbidden', AUTH_MESSAGES.forbidden);
export const listNotFoundExample = error(404, 'Not Found', EVENT_NOT_FOUND_MESSAGE);

/** Exemples du contrat de la liste d'attente (US14). */

const WAITLIST_PATH = `/api/v1/events/${EVENT_ID}/waitlist`;
const WAITLIST_ID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const WAITLIST_LEAVE_PATH = `/api/v1/waitlist/${WAITLIST_ID}`;

export const waitlistEntryExample: WaitlistEntryDto = {
  id: WAITLIST_ID,
  eventId: EVENT_ID,
  createdAt: TIMESTAMP,
  position: 2,
};

export const userWaitlistExample: UserWaitlistEntryDto[] = [
  {
    id: WAITLIST_ID,
    createdAt: TIMESTAMP,
    position: 2,
    event: userRegistrationsExample[0].event,
  },
];

export const unauthenticatedWaitlistExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  WAITLIST_PATH,
);
export const waitlistEventNotFoundExample = error(
  404,
  'Not Found',
  EVENT_NOT_FOUND_MESSAGE,
  WAITLIST_PATH,
);
export const alreadyOnWaitlistExample = error(
  409,
  'Conflict',
  REGISTRATION_MESSAGES.alreadyOnWaitlist,
  WAITLIST_PATH,
);
export const waitlistRegisteredExample = error(
  409,
  'Conflict',
  REGISTRATION_MESSAGES.waitlistRegistered,
  WAITLIST_PATH,
);
export const unauthenticatedWaitlistListExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  '/api/v1/waitlist/me',
);
export const waitlistLeaveUnauthenticatedExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  WAITLIST_LEAVE_PATH,
);
export const waitlistLeaveNotOwnerExample = error(
  403,
  'Forbidden',
  REGISTRATION_MESSAGES.waitlistNotOwner,
  WAITLIST_LEAVE_PATH,
);
export const waitlistLeaveNotFoundExample = error(
  404,
  'Not Found',
  REGISTRATION_MESSAGES.waitlistNotFound,
  WAITLIST_LEAVE_PATH,
);

/** Exemples du contrat de l'export des inscrits en CSV (US13). */

const EXPORT_PATH = `/api/v1/events/${EVENT_ID}/registrations.csv`;

/** Le fichier réel commence par un BOM UTF-8, omis ici pour garder l'exemple lisible. */
export const registrationsCsvExample =
  "Nom;Prénom;Email;Date d'inscription\r\n" +
  'Dupont;Léa;lea.dupont@example.com;20/11/2026 10:15\r\n' +
  'Lefèvre;Éloïse;eloise.lefevre@example.com;21/11/2026 18:42\r\n';
export const registrationsCsvDispositionExample =
  'attachment; filename="inscrits-nuit-du-jazz-2026-12-05.csv"; ' +
  "filename*=UTF-8''inscrits-nuit-du-jazz-2026-12-05.csv";

export const exportUnauthenticatedExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  EXPORT_PATH,
);
export const exportNotOrganizerExample = error(
  403,
  'Forbidden',
  REGISTRATION_MESSAGES.exportNotOrganizer,
  EXPORT_PATH,
);
export const exportParticipantExample = error(
  403,
  'Forbidden',
  AUTH_MESSAGES.forbidden,
  EXPORT_PATH,
);
export const exportNotFoundExample = error(404, 'Not Found', EVENT_NOT_FOUND_MESSAGE, EXPORT_PATH);
