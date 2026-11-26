/**
 * CSV des inscrits simulé (US13), aux mêmes règles que l'API : BOM UTF-8, séparateur `;`,
 * CRLF, dates à l'heure de Paris, formules neutralisées, nom `inscrits-<slug>-<AAAA-MM-JJ>.csv`.
 */

export interface MockCsvRow {
  lastName: string;
  firstName: string;
  email: string;
  createdAt: string;
}

const BOM = String.fromCharCode(0xfeff);
const CRLF = '\r\n';
const HEADER = "Nom;Prénom;Email;Date d'inscription";

const parisParts = (date: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(date))
      .map(({ type, value }) => [type, value]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;

function toCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const slug = (title: string, ascii: boolean) => {
  let text = title.toLocaleLowerCase('fr-FR');
  if (ascii) text = text.replace(/œ/g, 'oe').normalize('NFD').replace(/\p{M}/gu, '');
  return text.replace(ascii ? /[^a-z0-9]+/g : /[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
};

export function mockRegistrationsCsv(
  event: { title: string; startsAt: string },
  rows: MockCsvRow[],
) {
  const lines = [...rows]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((row) => {
      const { day, month, year, hour, minute } = parisParts(row.createdAt);
      const date = `${day}/${month}/${year} ${hour}:${minute}`;
      return [row.lastName, row.firstName, row.email, date].map(toCell).join(';');
    });
  const { day, month, year } = parisParts(event.startsAt);
  const name = (ascii: boolean) =>
    `inscrits-${slug(event.title, ascii) || 'evenement'}-${year}-${month}-${day}.csv`;

  return {
    content: BOM + [HEADER, ...lines].map((line) => line + CRLF).join(''),
    contentDisposition: `attachment; filename="${name(true)}"; filename*=UTF-8''${encodeURIComponent(name(false))}`,
  };
}
