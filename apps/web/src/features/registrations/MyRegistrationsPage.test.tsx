import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http as mswHttp, HttpResponse } from 'msw';
import { api } from '../../api/client';
import { DEMO_PASSWORD, demoUsers, mockAuth } from '../../mocks/auth';
import { events } from '../../mocks/fixtures';
import { createHandlers } from '../../mocks/handlers';
import { mockRegistrations } from '../../mocks/registrations';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';
import { formatDateTime } from '../events/format';

const [participant, organizer] = demoUsers;
const upcoming = events[1];
const other = events[2];
const past = {
  ...events[3],
  id: 'evt-past',
  title: 'Soirée passée',
  startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  endsAt: new Date(Date.now() - 3 * 86_400_000 + 3_600_000).toISOString(),
};

function signIn() {
  mockAuth.signIn(participant.email);
}

function useEventsWithPast() {
  server.use(...createHandlers([...events, past]));
}

describe("Annulation d'une inscription (US06, Front)", () => {
  it('redirige un visiteur vers la connexion', async () => {
    const { router } = renderApp('/mes-inscriptions');
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
    expect(router.state.location.search).toBe('?redirect=%2Fmes-inscriptions');
  });

  it('propose « Annuler » sur chaque inscription à venir, pas sur les passées', async () => {
    useEventsWithPast();
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    mockRegistrations.add(other.id, participant.id);
    mockRegistrations.add(past.id, participant.id);
    renderApp('/mes-inscriptions');

    const soon = await screen.findByRole('region', { name: 'À venir' });
    expect(within(soon).getAllByRole('button', { name: /^Annuler l'inscription à / })).toHaveLength(
      2,
    );
    const finished = screen.getByRole('region', { name: 'Passées' });
    expect(within(finished).getByText(past.title)).toBeInTheDocument();
    expect(within(finished).queryByRole('button')).not.toBeInTheDocument();
    expect(within(finished).getByText('Terminé')).toBeInTheDocument();
  });

  it("demande une confirmation, et « Garder mon inscription » n'annule rien", async () => {
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    const user = userEvent.setup();
    renderApp('/mes-inscriptions');

    await user.click(
      await screen.findByRole('button', { name: `Annuler l'inscription à ${upcoming.title}` }),
    );
    const dialog = await screen.findByRole('alertdialog', { name: 'Annuler cette inscription ?' });
    expect(within(dialog).getByText(upcoming.title)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Garder mon inscription' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Garder mon inscription' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockRegistrations.forUser(participant.id)).toHaveLength(1);
    expect(screen.getByText(upcoming.title)).toBeInTheDocument();
  });

  it('ferme la boîte de confirmation avec Échap', async () => {
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    const user = userEvent.setup();
    renderApp('/mes-inscriptions');

    await user.click(await screen.findByRole('button', { name: /^Annuler l'inscription à / }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockRegistrations.forUser(participant.id)).toHaveLength(1);
  });

  it('annule après confirmation : message affiché et place libérée (+1)', async () => {
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    const user = userEvent.setup();
    const { router } = renderApp('/mes-inscriptions');

    const seatsAfterRegistration = upcoming.remainingSeats - 1;
    expect(
      await screen.findByText(`${seatsAfterRegistration} places restantes`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Annuler l'inscription à / }));
    await user.click(await screen.findByRole('button', { name: 'Oui, annuler' }));

    expect(
      await screen.findByText(
        `Inscription à « ${upcoming.title} » annulée : la place est libérée.`,
      ),
    ).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText("Vous n'êtes inscrit à aucun événement")).toBeInTheDocument();
    expect(mockRegistrations.forUser(participant.id)).toHaveLength(0);

    await router.navigate(`/events/${upcoming.id}`);
    expect(
      await screen.findByText(`${upcoming.remainingSeats} places restantes`),
    ).toBeInTheDocument();
  });

  it("rouvre un événement complet : le bouton « S'inscrire » revient", async () => {
    const full = events.find((e) => e.isFull)!;
    signIn();
    // Le mock compte les inscriptions en plus de la fixture : on simule une place prise par l'utilisateur.
    server.use(...createHandlers([{ ...full, remainingSeats: 1, isFull: false }]));
    const registration = mockRegistrations.add(full.id, participant.id);
    const user = userEvent.setup();
    const { router } = renderApp(`/events/${full.id}`);
    expect(await screen.findByRole('button', { name: 'Complet' })).toBeDisabled();

    await router.navigate('/mes-inscriptions');
    await user.click(await screen.findByRole('button', { name: /^Annuler l'inscription à / }));
    await user.click(await screen.findByRole('button', { name: 'Oui, annuler' }));
    await screen.findByText("Vous n'êtes inscrit à aucun événement");
    expect(mockRegistrations.find(registration.id)).toBeUndefined();

    await router.navigate(`/events/${full.id}`);
    expect(await screen.findByRole('button', { name: "S'inscrire" })).toBeEnabled();
  });

  it("affiche l'erreur 403 de l'API et garde l'inscription", async () => {
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    server.use(
      mswHttp.delete('*/api/v1/registrations/:id', () =>
        HttpResponse.json(
          {
            statusCode: 403,
            error: 'Forbidden',
            message: "Vous ne pouvez pas annuler l'inscription d'un autre participant",
            path: '/api/v1/registrations/x',
            timestamp: new Date().toISOString(),
          },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp('/mes-inscriptions');

    await user.click(await screen.findByRole('button', { name: /^Annuler l'inscription à / }));
    await user.click(await screen.findByRole('button', { name: 'Oui, annuler' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Vous ne pouvez pas annuler l'inscription d'un autre participant",
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(upcoming.title)).toBeInTheDocument();
  });

  it('affiche une erreur générique si l’API est indisponible', async () => {
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    server.use(mswHttp.delete('*/api/v1/registrations/:id', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderApp('/mes-inscriptions');

    await user.click(await screen.findByRole('button', { name: /^Annuler l'inscription à / }));
    await user.click(await screen.findByRole('button', { name: 'Oui, annuler' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("L'annulation a échoué");
  });

  it('affiche un état vide avec un lien vers le catalogue', async () => {
    signIn();
    renderApp('/mes-inscriptions');
    expect(await screen.findByText("Vous n'êtes inscrit à aucun événement")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les événements' })).toHaveAttribute(
      'href',
      '/events',
    );
  });

  it('affiche le lien « Mes inscriptions » dans le menu de session', async () => {
    signIn();
    renderApp('/events');
    expect(await screen.findByRole('link', { name: 'Mes inscriptions' })).toHaveAttribute(
      'href',
      '/mes-inscriptions',
    );
  });
});

describe('Mes inscriptions (US07, Front)', () => {
  async function logIn(user: ReturnType<typeof userEvent.setup>, email: string) {
    await user.type(await screen.findByLabelText('Email'), email);
    await user.type(screen.getByLabelText('Mot de passe'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  }

  it('redirige un visiteur de /me/registrations vers la connexion, puis vers la page', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/me/registrations');

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
    expect(router.state.location.search).toBe('?redirect=%2Fme%2Fregistrations');

    await logIn(user, participant.email);
    expect(await screen.findByRole('heading', { name: 'Mes inscriptions' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/mes-inscriptions');
  });

  it("affiche le titre, la date et le lieu, et ouvre le détail de l'événement au clic", async () => {
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    const user = userEvent.setup();
    const { router } = renderApp('/mes-inscriptions');

    const soon = await screen.findByRole('region', { name: 'À venir' });
    expect(within(soon).getByText(formatDateTime(upcoming.startsAt))).toBeInTheDocument();
    expect(
      within(soon).getByText(`${upcoming.venue} · ${upcoming.city}`, { exact: false }),
    ).toBeInTheDocument();

    await user.click(within(soon).getByRole('link', { name: upcoming.title }));
    expect(router.state.location.pathname).toBe(`/events/${upcoming.id}`);
  });

  it("n'affiche jamais les inscriptions du compte précédent", async () => {
    signIn();
    mockRegistrations.add(upcoming.id, participant.id);
    const user = userEvent.setup();
    const { router } = renderApp('/mes-inscriptions');
    await screen.findByRole('link', { name: upcoming.title });

    await user.click(screen.getByRole('button', { name: 'Déconnexion' }));
    await user.click(await screen.findByRole('link', { name: 'Connexion' }));
    await logIn(user, organizer.email);
    await screen.findByText(`Bonjour ${organizer.firstName}`);

    // La réponse de l'API est retenue : seul le cache pourrait afficher quelque chose.
    server.use(mswHttp.get('*/api/v1/registrations/me', () => delay('infinite')));
    await router.navigate('/mes-inscriptions');

    expect(await screen.findByText('Chargement de vos inscriptions…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: upcoming.title })).not.toBeInTheDocument();
  });

  it('renvoie vers la connexion quand la session a expiré', async () => {
    signIn();
    server.use(
      mswHttp.get('*/api/v1/registrations/me', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'Authentification requise' },
          { status: 401 },
        ),
      ),
    );
    const { router } = renderApp('/mes-inscriptions');

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
    expect(router.state.location.search).toBe('?redirect=%2Fmes-inscriptions');
  });
});

describe("Règles de l'API simulée (mocks MSW)", () => {
  it("refuse d'annuler l'inscription d'un autre utilisateur (403)", async () => {
    mockAuth.signIn(organizer.email);
    const registration = mockRegistrations.add(upcoming.id, participant.id);

    const { response, error } = await api.DELETE('/api/v1/registrations/{id}', {
      params: { path: { id: registration.id } },
    });

    expect(response.status).toBe(403);
    expect(error?.message).toBe("Vous ne pouvez pas annuler l'inscription d'un autre participant");
    expect(mockRegistrations.find(registration.id)).toBeDefined();
  });

  it("refuse d'annuler une inscription à un événement passé (409)", async () => {
    useEventsWithPast();
    signIn();
    const registration = mockRegistrations.add(past.id, participant.id);

    const { response } = await api.DELETE('/api/v1/registrations/{id}', {
      params: { path: { id: registration.id } },
    });

    expect(response.status).toBe(409);
    expect(mockRegistrations.find(registration.id)).toBeDefined();
  });

  it('renvoie 401 sans session et 404 pour une inscription inconnue', async () => {
    const unknown = { params: { path: { id: 'inconnue' } } };
    expect((await api.DELETE('/api/v1/registrations/{id}', unknown)).response.status).toBe(401);
    signIn();
    expect((await api.DELETE('/api/v1/registrations/{id}', unknown)).response.status).toBe(404);
  });
});
