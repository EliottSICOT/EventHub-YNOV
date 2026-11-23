import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { mockAuth } from '../../mocks/auth';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';

const valid = {
  lastName: 'Dupont',
  firstName: 'Léa',
  email: 'lea.dupont@example.com',
  password: 'motdepasse-solide',
};

async function fillAndSubmit(values: Partial<typeof valid> = {}) {
  const user = userEvent.setup();
  const v = { ...valid, ...values };
  await screen.findByRole('form', { name: 'Inscription' });
  if (v.lastName) await user.type(screen.getByLabelText('Nom'), v.lastName);
  if (v.firstName) await user.type(screen.getByLabelText('Prénom'), v.firstName);
  if (v.email) await user.type(screen.getByLabelText('Email'), v.email);
  if (v.password) await user.type(screen.getByLabelText('Mot de passe'), v.password);
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
  return user;
}

/** Compte les appels à un endpoint pendant le test. */
function countRequests(pathname: string) {
  const calls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === pathname) calls.push(request.method);
  });
  return calls;
}

describe('Inscription (US04)', () => {
  afterEach(() => server.events.removeAllListeners());

  it('crée le compte, connecte automatiquement et redirige vers la page demandée', async () => {
    const { router } = renderApp('/inscription?redirect=%2Fevents%3Fcity%3DLyon');

    await fillAndSubmit();

    await waitFor(() => expect(router.state.location.pathname).toBe('/events'));
    expect(router.state.location.search).toBe('?city=Lyon');
    expect(await screen.findByText('Bonjour Léa')).toBeInTheDocument();
    expect(mockAuth.currentUser).toMatchObject({ email: 'lea.dupont@example.com' });
  });

  it("redirige vers l'accueil sans page demandée", async () => {
    const { router } = renderApp('/inscription');
    await fillAndSubmit();
    await waitFor(() => expect(router.state.location.pathname).toBe('/events'));
  });

  it("affiche clairement qu'un email est déjà utilisé (409)", async () => {
    renderApp('/inscription');

    await fillAndSubmit({ email: 'participant1@eventhub.test' });

    const email = screen.getByLabelText('Email');
    const message = await screen.findByText(
      'Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.',
    );
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(message.textContent!);
    expect(email).toHaveFocus();
    expect(mockAuth.currentUser).toBeNull();
  });

  it("bloque un mot de passe de moins de 8 caractères sans appeler l'API", async () => {
    const signUpCalls = countRequests('/api/v1/auth/sign-up');
    renderApp('/inscription');

    await fillAndSubmit({ password: '1234567' });

    const password = screen.getByLabelText('Mot de passe');
    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 8 caractères'),
    ).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription(
      'Le mot de passe doit contenir au moins 8 caractères 8 caractères minimum',
    );
    expect(password).toHaveFocus();
    expect(signUpCalls).toHaveLength(0);
  });

  it('signale les champs obligatoires et met le focus sur le premier en erreur', async () => {
    renderApp('/inscription');

    await fillAndSubmit({ lastName: '', firstName: '' });

    expect(await screen.findByText('Le nom est obligatoire')).toBeInTheDocument();
    expect(screen.getByText('Le prénom est obligatoire')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toHaveFocus();
  });

  it('affiche les erreurs 400 du serveur sous les bons champs', async () => {
    server.use(
      http.post('*/api/v1/auth/sign-up', () =>
        HttpResponse.json(
          {
            statusCode: 400,
            error: 'Bad Request',
            message: 'La requête contient des champs invalides',
            details: [
              { field: 'firstName', message: 'Le prénom ne doit pas dépasser 100 caractères' },
              { field: 'email', message: "L'email n'est pas valide" },
            ],
            path: '/api/v1/auth/sign-up',
            timestamp: new Date().toISOString(),
          },
          { status: 400 },
        ),
      ),
    );
    renderApp('/inscription');

    await fillAndSubmit();

    const firstName = screen.getByLabelText('Prénom');
    await waitFor(() =>
      expect(firstName).toHaveAccessibleDescription(
        'Le prénom ne doit pas dépasser 100 caractères',
      ),
    );
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription("L'email n'est pas valide");
    expect(screen.getByLabelText('Nom')).not.toHaveAttribute('aria-invalid');
    expect(firstName).toHaveFocus();
  });

  it("désactive le bouton pendant l'envoi", async () => {
    server.use(
      http.post('*/api/v1/auth/sign-up', async () => {
        await delay(50);
        return HttpResponse.json(
          {
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'x',
            path: '',
            timestamp: '',
          },
          { status: 500 },
        );
      }),
    );
    renderApp('/inscription');

    await fillAndSubmit();

    expect(screen.getByRole('button', { name: 'Création du compte…' })).toBeDisabled();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/erreur inattendue/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeEnabled();
  });
});
