import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { mockAuth } from '../../mocks/auth';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';

// La barre du haut est le premier « banner » (jsdom en compte aussi pour les <header> des pages).
const topbar = () => within(screen.getAllByRole('banner')[0]);

describe('Session dans le layout (US04)', () => {
  it('propose Connexion et Inscription à un visiteur, avec retour sur la page courante', async () => {
    renderApp('/events?city=Lyon');

    expect(await topbar().findByRole('link', { name: 'Connexion' })).toHaveAttribute(
      'href',
      '/connexion?redirect=%2Fevents%3Fcity%3DLyon',
    );
    expect(topbar().getByRole('link', { name: 'Inscription' })).toHaveAttribute(
      'href',
      '/inscription?redirect=%2Fevents%3Fcity%3DLyon',
    );
  });

  it("n'affiche rien tant que /auth/me n'a pas répondu", async () => {
    mockAuth.signIn('camille@eventhub.test');
    server.use(http.get('*/api/v1/auth/me', () => delay('infinite')));
    renderApp('/events');

    await screen.findByText('15 événements');
    expect(topbar().queryByRole('link', { name: 'Connexion' })).not.toBeInTheDocument();
    expect(topbar().queryByText(/Bonjour/)).not.toBeInTheDocument();
  });

  it('affiche le prénom de la session existante (rafraîchissement)', async () => {
    mockAuth.signIn('camille@eventhub.test');
    renderApp('/events');

    expect(await topbar().findByText('Bonjour Camille')).toBeInTheDocument();
  });

  it('déconnecte, supprime la session et ramène au catalogue', async () => {
    const user = userEvent.setup();
    mockAuth.signIn('participant1@eventhub.test');
    const { router } = renderApp('/events/e1');

    await user.click(await topbar().findByRole('button', { name: 'Déconnexion' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/events'));
    expect(await topbar().findByRole('link', { name: 'Connexion' })).toBeInTheDocument();
    expect(topbar().queryByText(/Bonjour/)).not.toBeInTheDocument();
    expect(mockAuth.currentUser).toBeNull();
  });
});
