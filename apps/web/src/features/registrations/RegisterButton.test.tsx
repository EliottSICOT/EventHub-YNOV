import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp, HttpResponse } from 'msw';
import { DEMO_PASSWORD, mockAuth } from '../../mocks/auth';
import { events } from '../../mocks/fixtures';
import { createHandlers } from '../../mocks/handlers';
import { mockRegistrations } from '../../mocks/registrations';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';

const open = events.find((e) => !e.isFull && e.remainingSeats > 1)!;
const full = events.find((e) => e.isFull)!;

function signIn() {
  mockAuth.signIn('participant1@eventhub.test');
}

describe('Inscription à un événement (US05, Front)', () => {
  it("redirige un visiteur vers la connexion, puis le ramène sur l'événement", async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/events/${open.id}`);

    await user.click(await screen.findByRole('link', { name: "S'inscrire" }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
    expect(router.state.location.search).toBe(
      `?redirect=${encodeURIComponent(`/events/${open.id}`)}`,
    );

    await user.type(await screen.findByLabelText('Email'), 'participant1@eventhub.test');
    await user.type(screen.getByLabelText('Mot de passe'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/events/${open.id}`));
    expect(await screen.findByRole('button', { name: "S'inscrire" })).toBeEnabled();
  });

  it('inscrit un utilisateur connecté, confirme et met la jauge à jour', async () => {
    signIn();
    const user = userEvent.setup();
    renderApp(`/events/${open.id}`);

    expect(await screen.findByText(`${open.remainingSeats} places restantes`)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: "S'inscrire" }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      `Inscription confirmée : vous participez à « ${open.title} ».`,
    );
    expect(screen.getByText(`${open.remainingSeats - 1} places restantes`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inscrit ✓' })).toBeDisabled();
  });

  it("annonce l'e-mail de confirmation, avec l'adresse du compte (US11)", async () => {
    signIn();
    const user = userEvent.setup();
    renderApp(`/events/${open.id}`);

    await user.click(await screen.findByRole('button', { name: "S'inscrire" }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Vous allez recevoir un e-mail de confirmation à l'adresse participant1@eventhub.test.",
    );
  });

  it("n'annonce aucun e-mail quand l'inscription est refusée (US11)", async () => {
    signIn();
    // Depuis US14, une inscription existante est connue du Front (« Inscrit ✓ ») :
    // on simule donc un refus de l'API au moment du clic.
    server.use(
      mswHttp.post('*/api/v1/events/:id/registrations', () =>
        HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'Vous êtes déjà inscrit à cet événement' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp(`/events/${open.id}`);

    await user.click(await screen.findByRole('button', { name: "S'inscrire" }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vous êtes déjà inscrit à cet événement',
    );
    expect(screen.queryByText(/e-mail de confirmation/)).not.toBeInTheDocument();
  });

  it('désactive le bouton pendant la requête', async () => {
    signIn();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      mswHttp.post('*/api/v1/events/:id/registrations', async () => {
        await gate;
        return HttpResponse.json(
          {
            id: 'r1',
            eventId: open.id,
            createdAt: new Date().toISOString(),
            remainingSeats: open.remainingSeats - 1,
            isFull: false,
          },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderApp(`/events/${open.id}`);

    await user.click(await screen.findByRole('button', { name: "S'inscrire" }));
    expect(await screen.findByRole('button', { name: 'Inscription…' })).toBeDisabled();
    release();
    expect(await screen.findByRole('button', { name: 'Inscrit ✓' })).toBeInTheDocument();
  });

  it('refuse une seconde inscription au même événement (409)', async () => {
    signIn();
    const user = userEvent.setup();
    const { unmount } = renderApp(`/events/${open.id}`);
    await user.click(await screen.findByRole('button', { name: "S'inscrire" }));
    await screen.findByRole('button', { name: 'Inscrit ✓' });
    unmount();

    // Après rechargement, « Mes inscriptions » dit déjà que l'utilisateur est inscrit.
    renderApp(`/events/${open.id}`);
    expect(await screen.findByRole('button', { name: 'Inscrit ✓' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: "S'inscrire" })).not.toBeInTheDocument();
  });

  it("propose la liste d'attente pour un événement complet (US14)", async () => {
    signIn();
    const user = userEvent.setup();
    renderApp(`/events/${full.id}`);
    const join = await screen.findByRole('button', { name: "Rejoindre la liste d'attente" });
    // Le bouton reste désactivé tant que la liste d'attente de l'utilisateur n'est pas chargée.
    await waitFor(() => expect(join).toBeEnabled());
    expect(screen.queryByRole('button', { name: "S'inscrire" })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Rejoindre la liste d'attente" }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Vous êtes en liste d'attente (position 1)",
    );
    expect(screen.getByRole('button', { name: "Quitter la liste d'attente" })).toBeInTheDocument();
  });

  it('affiche « Événement terminé » pour un événement passé', async () => {
    signIn();
    const past = {
      ...open,
      id: 'evt-past',
      startsAt: new Date(Date.now() - 86_400_000).toISOString(),
      endsAt: new Date(Date.now() - 80_000_000).toISOString(),
    };
    server.use(...createHandlers([past]));
    renderApp(`/events/${past.id}`);
    expect(await screen.findByRole('button', { name: 'Événement terminé' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: "S'inscrire" })).not.toBeInTheDocument();
  });

  it('signale un événement devenu complet entre-temps et rafraîchit la jauge', async () => {
    signIn();
    const nearlyFull = { ...open, id: 'evt-last', remainingSeats: 1, isFull: false };
    server.use(...createHandlers([nearlyFull]));
    const user = userEvent.setup();
    renderApp(`/events/${nearlyFull.id}`);

    await screen.findByText('Dernière place');
    // Quelqu'un d'autre prend la dernière place avant le clic.
    mockRegistrations.add(nearlyFull.id, 'someone-else');
    await user.click(screen.getByRole('button', { name: "S'inscrire" }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cet événement est complet');
    expect(
      await screen.findByRole('button', { name: "Rejoindre la liste d'attente" }),
    ).toBeEnabled();
  });

  it("affiche une erreur claire si l'API est indisponible", async () => {
    signIn();
    server.use(
      mswHttp.post('*/api/v1/events/:id/registrations', () =>
        HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'boom' },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp(`/events/${open.id}`);
    await user.click(await screen.findByRole('button', { name: "S'inscrire" }));
    expect(await screen.findByRole('alert')).toHaveTextContent("L'inscription a échoué");
  });
});
