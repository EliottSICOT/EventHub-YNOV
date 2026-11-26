import createClient from 'openapi-fetch';
import type { paths } from './schema';
import type { ApiErrorBody } from './types';

/**
 * En dev, Vite redirige /api vers l'API (voir vite.config.ts) : l'URL de base est donc l'origine du Front.
 * VITE_API_URL permet de viser une API servie ailleurs.
 */
export const apiBaseUrl: string = import.meta.env.VITE_API_URL || globalThis.location?.origin;

export const api = createClient<paths>({
  baseUrl: apiBaseUrl,
  credentials: 'include',
  // Résolu à chaque appel (et non à la création) pour que MSW puisse intercepter fetch dans les tests.
  fetch: (request) => globalThis.fetch(request),
});

/** Erreur levée par les hooks de requête, porteuse du corps `ApiErrorDto`. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | undefined;

  constructor(status: number, body?: ApiErrorBody) {
    super(body?.message ?? `Erreur HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Déballe une réponse openapi-fetch : renvoie `data` ou lève une `ApiError`. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    throw new ApiError(result.response.status, result.error as ApiErrorBody | undefined);
  }
  return result.data;
}
