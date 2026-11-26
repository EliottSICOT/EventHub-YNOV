import { ApiError, apiBaseUrl } from '../../api/client';
import type { ApiErrorBody } from '../../api/types';

const FALLBACK_FILENAME = 'inscrits.csv';

/**
 * Nom du fichier d'un en-tête Content-Disposition (RFC 6266) : `filename*` (UTF-8, accents
 * gardés) d'abord, sinon `filename` (ASCII), sinon un nom par défaut.
 */
export function filenameFromDisposition(header: string | null): string {
  if (!header) return FALLBACK_FILENAME;
  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // Encodage invalide : on se rabat sur `filename`.
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(header);
  return (plain?.[1] ?? plain?.[2])?.trim() || FALLBACK_FILENAME;
}

/** Fait enregistrer `blob` par le navigateur sous le nom `filename`. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Libéré après le clic, une fois que le navigateur a pris le fichier en charge.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Télécharge le CSV des inscrits de `eventId` (US13) avec le cookie de session, puis le fait
 * enregistrer sous le nom donné par l'API. Lève une `ApiError` si l'API refuse, ou l'erreur
 * de `fetch` si le serveur est injoignable. Renvoie le nom du fichier.
 */
export async function downloadRegistrationsCsv(eventId: string): Promise<string> {
  const url = `${apiBaseUrl}/api/v1/events/${encodeURIComponent(eventId)}/registrations.csv`;
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ApiErrorBody | undefined;
    throw new ApiError(response.status, body);
  }
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition'));
  saveBlob(await response.blob(), filename);
  return filename;
}
