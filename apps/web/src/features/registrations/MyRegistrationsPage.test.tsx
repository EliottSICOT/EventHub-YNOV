import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http as mswHttp, HttpResponse } from 'msw';
import type { EventDetail } from '../../api/types';
import { DEMO_PASSWORD, demoUsers, mockAuth } from '../../mocks/auth';
import { events } from '../../mocks/fixtures';
import { createHandlers } from '../../mocks/handlers';
import { mockRegistrations } from '../../mocks/registrations';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';
import { formatDateTime } from '../events/format';

const DAY = 86_400_000;
const [participant, organizer] = demoUsers;

function eventAt(id: string, title: string, days: number): EventDetail {
  return {
    ...events[1],
    id,
    title,
    startsAt: new Date(Date.now() + days * DAY).toISOString(),
    endsAt: null,
  };
}

const soon = eventAt('evt-soon', 'Dans 2 jours', 2);
const later = eventAt('evt-later', 'Dans 20 jours', 20);
const yesterday = eventAt('evt-yesterday', 'Hier', -1);
const lastMonth = eventAt('evt-last-month', 'Le mois dernier', -30);

function signInWith(...registered: EventDetail[]) {
  server.use(...createHandlers([soon, later, yesterday, lastMonth]));
  mockAuth.signIn(participant.email);
  registered.forEach((event) => mockRegistrations.add(event.id, participant.id));
}

const titlesIn = (section: HTMLElement) =>
  within(section)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

describe('Mes inscriptions (US07, Front)', () => {
  it('redirige un visiteur vers la connexion, puis le ramène sur la page', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/me/registrations');

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
    expect(router.state.location.search).toBe('?redirect=%2Fme%2Fregistrations');

    await user.type(await screen.findByLabelText('Email'), participant.email);
    await user.type(screen.getByLabelText('Mot de passe'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('heading', { name: 'Mes inscriptions' })).toBeInTheDocument();
  });

  it("affiche le titre, la date et le lieu de l'événement", async () => {
    signInWith(soon);
    renderApp('/me/registrations');

    const section = await screen.findByRole('region', { name: 'À venir' });
    expect(within(section).getByRole('heading', { name: soon.title })).toBeInTheDocument();
    expect(within(section).getByText(formatDateTime(soon.startsAt))).toBeInTheDocument();
    expect(within(section).getByText(`${soon.venue} · ${soon.city}`)).toBeInTheDocument();
  });

  it('sépare les inscriptions à venir et passées, les plus proches en premier', async () => {
    signInWith(later, lastMonth, soon, yesterday);
    renderApp('/me/registrations');

    expect(titlesIn(await screen.findByRole('region', { name: 'À venir' }))).toEqual([
      soon.title,
      later.title,
    ]);
    expect(titlesIn(screen.getByRole('region', { name: 'Passées' }))).toEqual([
      yesterday.title,
      lastMonth.title,
    ]);
  });

  it('signale une section vide quand il ne reste que des inscriptions passées', async () => {
    signInWith(yesterday);
    renderApp('/me/registrations');

    expect(await screen.findByText('Aucune inscription à venir.')).toBeInTheDocument();
    expect(screen.queryByText("Vous n'avez aucune inscription")).not.toBeInTheDocument();
  });

  it("ouvre le détail de l'événement au clic", async () => {
    signInWith(soon);
    const user = userEvent.setup();
    const { router } = renderApp('/me/registrations');

    await user.click(await screen.findByRole('link', { name: soon.title }));
    expect(router.state.location.pathname).toBe(`/events/${soon.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: soon.title })).toBeInTheDocument();
  });

  it("propose le catalogue quand il n'y a aucune inscription", async () => {
    signInWith();
    renderApp('/me/registrations');

    expect(await screen.findByText("Vous n'avez aucune inscription")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le catalogue' })).toHaveAttribute(
      'href',
      '/events',
    );
  });

  it('est accessible depuis le menu, et contient une inscription faite entre-temps', async () => {
    signInWith(soon);
    const user = userEvent.setup();
    const { router } = renderApp('/me/registrations');
    await screen.findByRole('region', { name: 'À venir' });

    await router.navigate(`/events/${later.id}`);
    await user.click(await screen.findByRole('button', { name: "S'inscrire" }));
    await screen.findByRole('button', { name: 'Inscrit ✓' });
    await user.click(screen.getByRole('link', { name: 'Mes inscriptions' }));

    expect(await screen.findByRole('link', { name: later.title })).toBeInTheDocument();
  });

  it("n'affiche pas les inscriptions du compte précédent", async () => {
    signInWith(soon);
    const user = userEvent.setup();
    const { router } = renderApp('/me/registrations');
    await screen.findByRole('link', { name: soon.title });

    await user.click(screen.getByRole('button', { name: 'Déconnexion' }));
    await user.click(await screen.findByRole('link', { name: 'Connexion' }));
    await user.type(await screen.findByLabelText('Email'), organizer.email);
    await user.type(screen.getByLabelText('Mot de passe'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    await screen.findByText(`Bonjour ${organizer.firstName}`);

    await router.navigate('/me/registrations');
    expect(await screen.findByText("Vous n'avez aucune inscription")).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: soon.title })).not.toBeInTheDocument();
  });

  it('renvoie vers la connexion quand la session a expiré', async () => {
    signInWith(soon);
    server.use(
      mswHttp.get('*/api/v1/me/registrations', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'Authentification requise' },
          { status: 401 },
        ),
      ),
    );
    const { router } = renderApp('/me/registrations');

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
  });

  it("permet de réessayer si l'API est indisponible", async () => {
    signInWith(soon);
    server.use(
      mswHttp.get(
        '*/api/v1/me/registrations',
        () => HttpResponse.json({ message: 'boom' }, { status: 500 }),
        { once: true },
      ),
    );
    const user = userEvent.setup();
    renderApp('/me/registrations');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger vos inscriptions',
    );
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: soon.title })).toBeInTheDocument();
  });
});
