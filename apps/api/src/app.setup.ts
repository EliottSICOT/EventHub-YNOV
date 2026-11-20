import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { validationExceptionFactory } from './common/errors/validation.exception.js';

export const API_PREFIX = 'api/v1';

/** Configuration partagée par le serveur, les tests e2e et la génération du contrat. */
export function configureApp(app: INestApplication, frontUrl?: string) {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  if (frontUrl) {
    // Le cookie de session (Sprint 2) imposera credentials: true et une origine explicite.
    app.enableCors({ origin: frontUrl, credentials: true });
  }
}
