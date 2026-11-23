import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE } from './auth/auth.constants.js';
import { SESSION_SECURITY } from './auth/auth.controller.js';
import { ApiErrorDto } from './common/errors/api-error.dto.js';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('EventHub API')
    .setDescription(
      'Contrat de l’API EventHub. Toutes les erreurs suivent le schéma `ApiErrorDto`.',
    )
    .setVersion('1.0.0')
    .addCookieAuth(
      SESSION_COOKIE,
      { type: 'apiKey', in: 'cookie', description: 'Posé par `POST /auth/sign-in`' },
      SESSION_SECURITY,
    )
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
    extraModels: [ApiErrorDto],
  });
}
