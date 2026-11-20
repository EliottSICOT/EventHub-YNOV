import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createHandlers } from '../../mocks/handlers';
import { events } from '../../mocks/fixtures';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';

const cardTitles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

describe('Liste des événements (US01)', () => {
  it('affiche titre, date, lieu et places restantes, paginés par 12', async () => {
    renderApp('/events');

    expect(await screen.findByText('15 événements')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(12);

    const first = screen.getAllByRole('article')[0];
    expect(within(first).getByRole('link', { name: events[0].title })).toHaveAttribute(
      'href',
      `/events/${events[0].id}`,
    );
    expect(within(first).getByText(`${events[0].venue} · ${events[0].city}`)).toBeInTheDocument();
    expect(within(first).getByText('Complet')).toBeInTheDocument();
    expect(within(first).getByText('Gratuit')).toBeInTheDocument();
    expect(within(first).getByText(events[0].category.name)).toBeInTheDocument();
    expect(within(first).getByRole('time')).toHaveAttribute('datetime', events[0].startsAt);
  });

  it('passe à la page suivante', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/events');

    await user.click(await screen.findByRole('button', { name: 'Suivant' }));

    expect(await screen.findByText('Page 2 sur 2')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(router.state.location.search).toBe('?page=2');
  });

  it('affiche « Aucun événement » quand la liste est vide', async () => {
    server.use(...createHandlers([]));
    renderApp('/events');
    expect(await screen.findByText('Aucun événement')).toBeInTheDocument();
  });

  it("affiche une erreur et permet de réessayer quand l'API échoue", async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/v1/events', () => HttpResponse.json({}, { status: 500 }), { once: true }),
    );
    renderApp('/events');

    expect(await screen.findByText('Impossible de charger les événements')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('15 événements')).toBeInTheDocument();
  });
});

describe('Filtres du catalogue (US02)', () => {
  it('filtre par catégorie et reflète le filtre dans l’URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/events');
    await screen.findByText('15 événements');

    await user.selectOptions(screen.getByLabelText('Catégorie'), 'concert');

    await waitFor(() => expect(screen.getByText('3 événements')).toBeInTheDocument());
    expect(cardTitles()).toEqual(['Nuit du jazz', 'Festival électro', 'Rock en plein air']);
    expect(router.state.location.search).toBe('?category=concert');
  });

  it('combine catégorie et ville, puis réinitialise', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/events?category=concert');
    await screen.findByText('3 événements');

    await user.type(screen.getByLabelText('Ville'), 'lyon');
    await waitFor(() => expect(screen.getByText('1 événement')).toBeInTheDocument());
    expect(cardTitles()).toEqual(['Nuit du jazz']);
    expect(router.state.location.search).toBe('?category=concert&city=lyon');

    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    await waitFor(() => expect(screen.getByText('15 événements')).toBeInTheDocument());
    expect(screen.getByLabelText('Ville')).toHaveValue('');
    expect(screen.getByLabelText('Catégorie')).toHaveValue('');
    expect(router.state.location.search).toBe('');
  });

  it('restaure les filtres depuis l’URL', async () => {
    renderApp('/events?city=Paris');
    expect(await screen.findByLabelText('Ville')).toHaveValue('Paris');
    await waitFor(() => expect(screen.getByText('4 événements')).toBeInTheDocument());
  });

  it('indique quand aucun événement ne correspond aux filtres', async () => {
    renderApp('/events?city=Marseille');
    expect(
      await screen.findByText('Aucun événement ne correspond à ces filtres.'),
    ).toBeInTheDocument();
  });
});
