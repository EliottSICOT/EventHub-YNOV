import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
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
  // Lit le cookie de session posé par POST /auth/sign-in.
  app.use(cookieParser());
  if (frontUrl) {
    // Le cookie de session exige credentials: true, donc une origine explicite (jamais '*').
    // En dev, Vite proxifie /api : le Front et l'API partagent déjà la même origine.
    app.enableCors({ origin: frontUrl, credentials: true });
  }
}
