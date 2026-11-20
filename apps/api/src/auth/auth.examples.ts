import type { ApiErrorDto, FieldErrorDto } from '../common/errors/api-error.dto.js';
import { VALIDATION_MESSAGE } from '../common/errors/validation.exception.js';
import { AUTH_MESSAGES } from './auth.constants.js';
import type { UserDto } from './dto/user.dto.js';

/** Exemples du contrat OpenAPI pour les routes `/auth`. */

const TIMESTAMP = '2026-11-20T10:33:21.774Z';

function error(
  statusCode: number,
  label: string,
  message: string,
  path: string,
  details?: FieldErrorDto[],
): ApiErrorDto {
  return {
    statusCode,
    error: label,
    message,
    ...(details ? { details } : {}),
    path,
    timestamp: TIMESTAMP,
  };
}

export const userExample: UserDto = {
  id: '3f0c1a52-6a3e-4b8e-9a43-0d7f1e2b9c11',
  email: 'lea.dupont@example.com',
  firstName: 'Léa',
  lastName: 'Dupont',
  role: 'PARTICIPANT',
};

export const signUpValidationExample = error(
  400,
  'Bad Request',
  VALIDATION_MESSAGE,
  '/api/v1/auth/sign-up',
  [
    { field: 'email', message: "L'email n'est pas valide" },
    { field: 'password', message: 'Le mot de passe doit contenir au moins 8 caractères' },
  ],
);

export const signUpConflictExample = error(
  409,
  'Conflict',
  AUTH_MESSAGES.emailTaken,
  '/api/v1/auth/sign-up',
);

export const signInValidationExample = error(
  400,
  'Bad Request',
  VALIDATION_MESSAGE,
  '/api/v1/auth/sign-in',
  [{ field: 'password', message: 'Le mot de passe est obligatoire' }],
);

export const invalidCredentialsExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.invalidCredentials,
  '/api/v1/auth/sign-in',
);

export const unauthenticatedExample = error(
  401,
  'Unauthorized',
  AUTH_MESSAGES.unauthenticated,
  '/api/v1/auth/me',
);
