import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { EventDetail } from '../../api/types';
import { demoUsers, mockAuth } from '../../mocks/auth';
import { mockEvents } from '../../mocks/events';
import { events } from '../../mocks/fixtures';
import { mockRegistrations } from '../../mocks/registrations';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';
import { filenameFromDisposition } from './downloadRegistrationsCsv';

const [participant, organizer] = demoUsers;
const EXPORT_URL = '*/api/v1/events/:id/registrations.csv';
const other = events.find((e) => e.organizer.id !== organizer.id)!;

/** Événement de l'organisatrice de démo, au titre accentué, pour vérifier le nom du fichier. */
function addFestival(overrides: Partial<EventDetail> = {}): EventDetail {
  const base = events.find((e) => e.organizer.id === organizer.id)!;
  const festival = {
    ...base,
    id: crypto.randomUUID(),
    title: 'Fête de la musique',
    startsAt: '2030-06-21T16:00:00.000Z',
    endsAt: null,
    remainingSeats: base.capacity,
    isFull: false,
    ...overrides,
  };
  mockEvents.add(festival);
  return festival;
}

/** Remplace le téléchargement du navigateur : garde le Blob et le nom du lien cliqué. */
function captureDownloads() {
  const blobs: Blob[] = [];
  const downloads: string[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return 'blob:export';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  return { blobs, downloads };
}

async function openAsOrganizer(event: EventDetail) {
  mockAuth.signIn(organizer.email);
  renderApp(`/events/${event.id}`);
  const button = await screen.findByRole('button', { name: 'Exporter en CSV' });
  return { button, user: userEvent.setup() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Export des inscrits en CSV (US13, Front)', () => {
  it("propose « Exporter en CSV » à l'organisateur de l'événement", async () => {
    await openAsOrganizer(addFestival());
  });

  it.each([
    ['un visiteur', null, () => addFestival().id],
    ['un participant', participant.email, () => addFestival().id],
    ['un autre organisateur', organizer.email, () => other.id],
  ])('ne le propose pas à %s', async (_label, email, eventId) => {
    if (email) mockAuth.signIn(email);
    renderApp(`/events/${eventId()}`);
    await screen.findByRole('heading', { level: 1 });
    await screen.findByRole(email ? 'button' : 'link', { name: "S'inscrire" });
    expect(screen.queryByRole('button', { name: 'Exporter en CSV' })).not.toBeInTheDocument();
  });

  it.each([
    ['annulé', { isCancelled: true }],
    ['passé', { startsAt: '2020-06-21T16:00:00.000Z' }],
  ])('le propose encore pour un événement %s, sans Modifier ni Supprimer', async (_, overrides) => {
    await openAsOrganizer(addFestival(overrides));
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Modifier' })).not.toBeInTheDocument();
  });

  it('télécharge le CSV sous le nom donné par l’API, avec accents et BOM', async () => {
    const festival = addFestival();
    mockRegistrations.add(festival.id, participant.id);
    const { blobs, downloads } = captureDownloads();
    const { button, user } = await openAsOrganizer(festival);

    await user.click(button);

    expect(
      await screen.findByText('Fichier inscrits-fête-de-la-musique-2030-06-21.csv téléchargé.'),
    ).toBeInTheDocument();
    expect(downloads).toEqual(['inscrits-fête-de-la-musique-2030-06-21.csv']);
    expect(blobs).toHaveLength(1);
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    expect(text.split('\r\n')).toEqual([
      "\u{feff}Nom;Prénom;Email;Date d'inscription",
      expect.stringMatching(
        /^1;Participant;participant1@eventhub\.test;\d\d\/\d\d\/\d{4} \d\d:\d\d$/,
      ),
      '',
    ]);
  });

  it("envoie le cookie de session et affiche l'état de chargement", async () => {
    let release: () => void = () => {};
    server.use(
      http.get(EXPORT_URL, async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return new HttpResponse("\u{feff}Nom;Prénom;Email;Date d'inscription\r\n", {
          headers: { 'Content-Disposition': 'attachment; filename="inscrits.csv"' },
        });
      }),
    );
    captureDownloads();
    const festival = addFestival();
    const { button, user } = await openAsOrganizer(festival);
    // MSW reconstruit la requête et perd `credentials` : on regarde l'appel à fetch lui-même.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await user.click(button);

    const pending = await screen.findByRole('button', { name: 'Export en cours…' });
    expect(pending).toBeDisabled();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/api/v1/events/${festival.id}/registrations\\.csv$`)),
      { credentials: 'include' },
    );
    release();
    expect(await screen.findByRole('button', { name: 'Exporter en CSV' })).toBeEnabled();
  });

  it("affiche un message clair si l'API refuse l'export (403)", async () => {
    server.use(
      http.get(EXPORT_URL, () =>
        HttpResponse.json(
          {
            statusCode: 403,
            error: 'Forbidden',
            message: "Seul l'organisateur de l'événement peut exporter la liste de ses inscrits",
            path: '/api/v1/events/x/registrations.csv',
            timestamp: new Date().toISOString(),
          },
          { status: 403 },
        ),
      ),
    );
    const { downloads } = captureDownloads();
    const { button, user } = await openAsOrganizer(addFestival());

    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Vous n'avez pas accès à la liste des inscrits : seul l'organisateur de l'événement peut l'exporter.",
    );
    expect(downloads).toEqual([]);
    expect(button).toBeEnabled();
  });

  it('affiche un message clair si le serveur est injoignable', async () => {
    server.use(http.get(EXPORT_URL, () => HttpResponse.error()));
    const { downloads } = captureDownloads();
    const { button, user } = await openAsOrganizer(addFestival());

    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.',
    );
    expect(downloads).toEqual([]);
  });
});

describe('filenameFromDisposition', () => {
  it.each([
    [
      `attachment; filename="inscrits-fete-2030-06-21.csv"; filename*=UTF-8''inscrits-f%C3%AAte-2030-06-21.csv`,
      'inscrits-fête-2030-06-21.csv',
    ],
    ['attachment; filename="inscrits-fete-2030-06-21.csv"', 'inscrits-fete-2030-06-21.csv'],
    ['attachment; filename=inscrits.csv', 'inscrits.csv'],
    [`attachment; filename="repli.csv"; filename*=UTF-8''%E0%A4%A`, 'repli.csv'],
    ['attachment', 'inscrits.csv'],
    [null, 'inscrits.csv'],
  ])('lit %s', (header, filename) => {
    expect(filenameFromDisposition(header)).toBe(filename);
  });
});
