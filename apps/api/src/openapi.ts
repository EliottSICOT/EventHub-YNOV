import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorDto } from './common/errors/api-error.dto.js';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('EventHub API')
    .setDescription(
      'Contrat de l’API EventHub. Toutes les erreurs suivent le schéma `ApiErrorDto`.',
    )
    .setVersion('1.0.0')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
    extraModels: [ApiErrorDto],
  });
}
