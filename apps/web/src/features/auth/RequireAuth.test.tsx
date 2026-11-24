import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { Layout } from '../../app/Layout';
import { routes as appRoutes } from '../../app/routes';
import { DEMO_PASSWORD, mockAuth } from '../../mocks/auth';
import { renderApp } from '../../test/render';
import { RequireAuth, RequireOrganizer } from './RequireAuth';

/** Routes de l'application, plus deux routes protégées propres au test. */
const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: 'mes-inscriptions',
        element: (
          <RequireAuth>
            <h1>Mes inscriptions</h1>
          </RequireAuth>
        ),
      },
      {
        element: <RequireOrganizer />,
        children: [{ path: 'organisateur', element: <h1>Espace organisateur</h1> }],
      },
      ...(appRoutes[0].children ?? []),
    ],
  },
];

describe('RequireAuth', () => {
  it('redirige un visiteur vers la connexion, puis le ramène une fois connecté', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/mes-inscriptions?tri=date', routes);

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
    expect(router.state.location.search).toBe('?redirect=%2Fmes-inscriptions%3Ftri%3Ddate');

    await user.type(await screen.findByLabelText('Email'), 'participant1@eventhub.test');
    await user.type(screen.getByLabelText('Mot de passe'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('heading', { name: 'Mes inscriptions' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?tri=date');
  });

  it('affiche la page à un utilisateur connecté', async () => {
    mockAuth.signIn('participant1@eventhub.test');
    renderApp('/mes-inscriptions', routes);

    expect(await screen.findByRole('heading', { name: 'Mes inscriptions' })).toBeInTheDocument();
  });

  describe('avec le rôle ORGANIZER', () => {
    it('redirige un visiteur vers la connexion', async () => {
      const { router } = renderApp('/organisateur', routes);
      await waitFor(() => expect(router.state.location.search).toBe('?redirect=%2Forganisateur'));
    });

    it('refuse un participant', async () => {
      mockAuth.signIn('participant1@eventhub.test');
      renderApp('/organisateur', routes);

      expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Espace organisateur' }),
      ).not.toBeInTheDocument();
    });

    it('laisse passer un organisateur', async () => {
      mockAuth.signIn('camille@eventhub.test');
      renderApp('/organisateur', routes);

      expect(
        await screen.findByRole('heading', { name: 'Espace organisateur' }),
      ).toBeInTheDocument();
    });
  });
});
