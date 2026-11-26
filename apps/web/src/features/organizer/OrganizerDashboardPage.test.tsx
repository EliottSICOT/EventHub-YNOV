import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockAuth } from '../../mocks/auth';
import { events } from '../../mocks/fixtures';
import { createHandlers } from '../../mocks/handlers';
import { mockRegistrations } from '../../mocks/registrations';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';
import { formatDateTime } from '../events/format';

const PAGE = '/organisateur/evenements';
const participantId = '0d6a1b52-1b0e-4b8e-9a43-0d7f1e2b9c01';
const camilleEvents = events.filter((e) => e.organizer.name === 'Camille Martin');
/** Événement à venir pas encore complet, pour pouvoir ajouter une inscription mock. */
const upcoming = camilleEvents.find((e) => !e.isFull)!;
const past = {
  ...camilleEvents[0],
  id: 'evt-past-org',
  title: "Concert d'hier",
  startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  endsAt: new Date(Date.now() - 3 * 86_400_000 + 3_600_000).toISOString(),
  remainingSeats: camilleEvents[0].capacity - 5,
  isFull: false,
};

function signInOrganizer() {
  mockAuth.signIn('camille@eventhub.test');
}

describe('Tableau de bord organisateur (US12, Front)', () => {
  it('redirige un visiteur vers la connexion', async () => {
    const { router } = renderApp(PAGE);
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
    expect(router.state.location.search).toBe(`?redirect=${encodeURIComponent(PAGE)}`);
  });

  it('refuse un participant', async () => {
    mockAuth.signIn('participant1@eventhub.test');
    renderApp(PAGE);
    expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
  });

  it('sépare les événements à venir et passés avec le remplissage', async () => {
    server.use(...createHandlers([...events, past]));
    signInOrganizer();
    mockRegistrations.add(upcoming.id, participantId);
    renderApp(PAGE);

    expect(await screen.findByRole('heading', { name: 'Mes événements' })).toBeInTheDocument();

    const soon = screen.getByRole('region', { name: 'À venir' });
    expect(within(soon).getByText(upcoming.title)).toBeInTheDocument();
    expect(within(soon).getByText(formatDateTime(upcoming.startsAt))).toBeInTheDocument();
    const remainingAfter = Math.max(0, upcoming.remainingSeats - 1);
    const registered = upcoming.capacity - remainingAfter;
    const fillRate = Math.round((registered / upcoming.capacity) * 100);
    expect(
      within(soon).getByText(`${registered} / ${upcoming.capacity} · ${fillRate} %`),
    ).toBeInTheDocument();

    const finished = screen.getByRole('region', { name: 'Passés' });
    expect(within(finished).getByText(past.title)).toBeInTheDocument();
    const pastFill = Math.round((5 / past.capacity) * 100);
    expect(within(finished).getByText(`5 / ${past.capacity} · ${pastFill} %`)).toBeInTheDocument();
  });

  it("n'affiche que les événements de l'organisateur connecté", async () => {
    signInOrganizer();
    renderApp(PAGE);

    await screen.findByRole('heading', { name: 'Mes événements' });
    for (const event of events.filter((e) => e.organizer.name === 'Yanis Bernard')) {
      expect(screen.queryByText(event.title)).not.toBeInTheDocument();
    }
    expect(screen.getByText(camilleEvents[0].title)).toBeInTheDocument();
  });

  it('ouvre la liste des inscrits depuis un événement', async () => {
    signInOrganizer();
    mockRegistrations.add(upcoming.id, participantId);
    const user = userEvent.setup();
    const { router } = renderApp(PAGE);

    const soon = await screen.findByRole('region', { name: 'À venir' });
    const row = within(soon)
      .getAllByRole('row')
      .find((r) => within(r).queryByText(upcoming.title));
    expect(row).toBeTruthy();
    await user.click(within(row!).getByRole('link', { name: 'Voir les inscrits' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/organisateur/evenements/${upcoming.id}/inscrits`),
    );
    expect(await screen.findByRole('heading', { name: new RegExp(upcoming.title) })).toBeInTheDocument();
    expect(screen.getByText('Participant')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('participant1@eventhub.test')).toBeInTheDocument();
  });
});
