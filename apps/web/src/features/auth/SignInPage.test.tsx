import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_PASSWORD, mockAuth } from '../../mocks/auth';
import { renderApp } from '../../test/render';

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await screen.findByRole('form', { name: 'Connexion' });
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Mot de passe'), password);
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  return user;
}

describe('Connexion (US04)', () => {
  it('connecte, affiche le prénom dans le layout et revient sur la page d’origine', async () => {
    const { router } = renderApp('/connexion?redirect=%2Fevents%2Fe1');

    await signIn('Camille@eventhub.test', DEMO_PASSWORD);

    await waitFor(() => expect(router.state.location.pathname).toBe('/events/e1'));
    expect(await screen.findByText('Bonjour Camille')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Déconnexion' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Connexion' })).not.toBeInTheDocument();
    expect(mockAuth.currentUser?.email).toBe('camille@eventhub.test');
  });

  it("redirige vers l'accueil sans page d'origine", async () => {
    const { router } = renderApp('/connexion');
    await signIn('participant1@eventhub.test', DEMO_PASSWORD);
    await waitFor(() => expect(router.state.location.pathname).toBe('/events'));
  });

  it('ignore une redirection vers un autre site', async () => {
    const { router } = renderApp('/connexion?redirect=https%3A%2F%2Fexemple.com');
    await signIn('participant1@eventhub.test', DEMO_PASSWORD);
    await waitFor(() => expect(router.state.location.pathname).toBe('/events'));
  });

  it.each([
    ['un mauvais mot de passe', 'participant1@eventhub.test', 'mauvais-mdp'],
    ['un email inconnu', 'inconnu@example.com', DEMO_PASSWORD],
  ])('affiche le message générique de l’API pour %s', async (_cas, email, password) => {
    const { router } = renderApp('/connexion');

    await signIn(email, password);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email ou mot de passe incorrect');
    expect(alert).toHaveFocus();
    // Aucun champ n'est désigné comme fautif.
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Mot de passe')).not.toHaveAttribute('aria-invalid');
    expect(router.state.location.pathname).toBe('/connexion');
    expect(mockAuth.currentUser).toBeNull();
  });

  it('demande les champs vides avant tout envoi', async () => {
    renderApp('/connexion');

    await signIn('', '');

    expect(await screen.findByText("L'email est obligatoire")).toBeInTheDocument();
    expect(screen.getByText('Le mot de passe est obligatoire')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });
});
