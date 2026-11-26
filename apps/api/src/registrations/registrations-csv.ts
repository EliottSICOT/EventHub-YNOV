/**
 * Export des inscrits d'un événement en CSV (US13), lisible tel quel dans Excel en français :
 * BOM UTF-8 (sans lui, Excel lit le fichier en Windows-1252 et casse les accents), séparateur `;`
 * (celui qu'Excel attend quand la virgule est le séparateur décimal) et fins de ligne CRLF.
 */

export interface CsvEvent {
  title: string;
  startsAt: Date;
}

export interface CsvRegistration {
  createdAt: Date;
  user: { lastName: string; firstName: string; email: string };
}

export interface RegistrationsCsv {
  content: string;
  /** Nom du fichier en UTF-8, accents gardés (`filename*` de Content-Disposition). */
  filename: string;
  /** Même nom en ASCII, pour les clients qui ignorent `filename*`. */
  asciiFilename: string;
}

export const REGISTRATIONS_CSV_HEADER = "Nom;Prénom;Email;Date d'inscription";

const BOM = '﻿';
const SEPARATOR = ';';
const CRLF = '\r\n';
const TIME_ZONE = 'Europe/Paris';
const FALLBACK_SLUG = 'evenement';

/** Premiers caractères qui font lire une cellule comme une formule (Excel, LibreOffice, Sheets). */
const FORMULA_START = /^[=+\-@\t\r]/;
/** Caractères qui obligent à mettre la valeur entre guillemets. */
const NEEDS_QUOTES = /[";\r\n]/;
/** Lettres sans décomposition Unicode, remplacées à la main dans le nom ASCII. */
const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss' };

const dateParts = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Année, mois, jour, heure et minute de `date` à l'heure de Paris, sur 2 ou 4 chiffres. */
function parisParts(date: Date) {
  const parts = Object.fromEntries(
    dateParts.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

/** `JJ/MM/AAAA HH:mm`, heure de Paris. */
function formatDateTime(date: Date): string {
  const { day, month, year, hour, minute } = parisParts(date);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/** `AAAA-MM-JJ`, heure de Paris. */
function formatDay(date: Date): string {
  const { day, month, year } = parisParts(date);
  return `${year}-${month}-${day}`;
}

/**
 * Noms, prénoms et emails sont saisis par les utilisateurs. Une valeur qui commence comme une
 * formule est préfixée d'une apostrophe (injection CSV) ; une valeur qui contient `;`, `"` ou un
 * saut de ligne est mise entre guillemets, ses guillemets doublés.
 */
function toCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function toLine(cells: string[]): string {
  return cells.map(toCell).join(SEPARATOR) + CRLF;
}

/** Minuscules, chaque suite de caractères autres que lettres et chiffres devient un tiret. */
function slugify(title: string): string {
  return title
    .normalize('NFC')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function asciiSlugify(title: string): string {
  return slugify(title)
    .replace(/[œæß]/g, (letter) => LIGATURES[letter])
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fileName(slug: string, event: CsvEvent): string {
  return `inscrits-${slug || FALLBACK_SLUG}-${formatDay(event.startsAt)}.csv`;
}

/** Construit le CSV des inscrits de `event`, triés par date d'inscription, et son nom de fichier. */
export function toRegistrationsCsv(
  event: CsvEvent,
  registrations: readonly CsvRegistration[],
): RegistrationsCsv {
  const rows = [...registrations]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(({ createdAt, user }) =>
      toLine([user.lastName, user.firstName, user.email, formatDateTime(createdAt)]),
    );

  return {
    content: BOM + REGISTRATIONS_CSV_HEADER + CRLF + rows.join(''),
    filename: fileName(slugify(event.title), event),
    asciiFilename: fileName(asciiSlugify(event.title), event),
  };
}

/** En-tête Content-Disposition (RFC 6266) : `filename` en ASCII, `filename*` en UTF-8. */
export function contentDisposition({ filename, asciiFilename }: RegistrationsCsv): string {
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
