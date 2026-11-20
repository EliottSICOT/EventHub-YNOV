/**
 * Génère contract/openapi.json à la racine du dépôt, sans base de données.
 * Usage : pnpm --filter api openapi:generate
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { configureApp } from '../app.setup.js';
import { buildOpenApiDocument } from '../openapi.js';

const output = resolve(import.meta.dirname, '../../../../contract/openapi.json');

process.env.DATABASE_URL ??= 'postgresql://unused@localhost/unused';
const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
configureApp(app);
const document = buildOpenApiDocument(app);
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
await app.close();
console.log(`Contrat OpenAPI écrit dans ${output}`);
