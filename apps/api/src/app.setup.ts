import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { validationExceptionFactory } from './common/errors/validation.exception.js';
import { resolveUploadsDir, UPLOADS_ROUTE } from './uploads/uploads.js';

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
  // Images des événements (US08), hors du préfixe /api/v1. Seuls des PNG et JPEG y sont écrits ;
  // nosniff empêche le navigateur d'interpréter un fichier autrement que selon son extension.
  (app as NestExpressApplication).useStaticAssets(resolveUploadsDir(), {
    prefix: UPLOADS_ROUTE,
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  if (frontUrl) {
    // Le cookie de session exige credentials: true, donc une origine explicite (jamais '*').
    // En dev, Vite proxifie /api : le Front et l'API partagent déjà la même origine.
    // Content-Disposition porte le nom du fichier CSV des inscrits (US13), lu par le Front.
    app.enableCors({
      origin: frontUrl,
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    });
  }
}
