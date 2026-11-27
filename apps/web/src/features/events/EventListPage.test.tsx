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

describe('Aucun événement passé, pagination cohérente (US01, #47)', () => {
  /** Date du jour en heure locale, au format YYYY-MM-DD. */
  const todayLocal = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it('empêche de choisir une date de début passée', async () => {
    renderApp('/events');
    expect(await screen.findByLabelText('Du')).toHaveAttribute('min', todayLocal());
  });

  it('garde la contrainte du champ « Au » par rapport à « Du »', async () => {
    renderApp('/events?from=2027-01-10');
    expect(await screen.findByLabelText('Au')).toHaveAttribute('min', '2027-01-10');
  });

  it('n’affiche pas un événement passé même avec un « Du » dans le passé', async () => {
    const past = {
      ...events[0],
      id: 'evt-passe',
      title: 'Édition passée',
      startsAt: '2020-06-01T18:00:00.000Z',
    };
    server.use(...createHandlers([past, ...events]));
    renderApp('/events?from=2020-01-01');

    expect(await screen.findByText('15 événements')).toBeInTheDocument();
    expect(screen.queryByText('Édition passée')).not.toBeInTheDocument();
  });

  it('ramène une page hors bornes à la dernière page, sans entrée d’historique', async () => {
    const { router } = renderApp('/events?page=99');

    expect(await screen.findByText('Page 2 sur 2')).toBeInTheDocument();
    expect(screen.getByText('15 événements')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByText('Aucun événement')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('retire le paramètre page quand il n’y a qu’une page, en gardant les filtres', async () => {
    const { router } = renderApp('/events?city=Paris&page=5');

    await waitFor(() => expect(router.state.location.search).toBe('?city=Paris'));
    expect(await screen.findByText('4 événements')).toBeInTheDocument();
    expect(await screen.findAllByRole('article')).toHaveLength(4);
  });
});

describe('Recherche et tri (US10)', () => {
  /** Paramètres des appels à GET /events pendant le test. */
  function spyOnRequests() {
    const queries: URLSearchParams[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/api/v1/events') queries.push(url.searchParams);
    });
    return queries;
  }

  const search = () => screen.getByLabelText('Rechercher');
  const sortBy = () => screen.getByLabelText('Trier par');

  it('cherche par mots, sans majuscules ni accents, et le reflète dans l’URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/events');
    await screen.findByText('15 événements');

    await user.type(search(), 'FESTIVAL electro');

    expect(await screen.findByText('1 événement')).toBeInTheDocument();
    expect(cardTitles()).toEqual(['Festival électro']);
    expect(router.state.location.search).toBe('?q=FESTIVAL+electro');
  });

  it('attend une pause de frappe : pas un appel par lettre', async () => {
    const user = userEvent.setup();
    const queries = spyOnRequests();
    renderApp('/events');
    await screen.findByText('15 événements');

    await user.type(search(), 'atelier');
    await waitFor(() => expect(queries.at(-1)?.get('q')).toBe('atelier'));

    // Décompte exact avec une horloge simulée : useDebouncedText.test.tsx.
    expect(queries.length).toBeLessThan('atelier'.length);
  });

  it.each([
    ['Prix croissant', 'price', (e: (typeof events)[number]) => e.priceCents, 1],
    ['Prix décroissant', '-price', (e: (typeof events)[number]) => e.priceCents, -1],
    [
      'Places restantes : moins au plus',
      'seats',
      (e: (typeof events)[number]) => e.remainingSeats,
      1,
    ],
    [
      'Places restantes : plus au moins',
      '-seats',
      (e: (typeof events)[number]) => e.remainingSeats,
      -1,
    ],
    ['Date : plus lointaine', '-date', (e: (typeof events)[number]) => Date.parse(e.startsAt), -1],
  ])('trie par « %s »', async (label, sort, key, direction) => {
    const user = userEvent.setup();
    const { router } = renderApp('/events');
    await screen.findByText('15 événements');

    await user.selectOptions(sortBy(), label);

    const expected = [...events]
      .sort((a, b) => direction * (key(a) - key(b)) || a.startsAt.localeCompare(b.startsAt))
      .slice(0, 12)
      .map((e) => e.title);
    await waitFor(() => expect(cardTitles()).toEqual(expected));
    expect(router.state.location.search).toBe(`?sort=${sort}`);
  });

  it("n'écrit pas le tri par défaut dans l'URL", async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/events?sort=price');
    await screen.findByText('15 événements');
    expect(sortBy()).toHaveValue('price');

    await user.selectOptions(sortBy(), 'Date : plus proche');
    expect(router.state.location.search).toBe('');
  });

  it('combine recherche, tri et filtres, restaurés depuis l’URL', async () => {
    const queries = spyOnRequests();
    renderApp('/events?q=lyon&category=concert&sort=-price');

    await waitFor(() => expect(search()).toHaveValue('lyon'));
    expect(sortBy()).toHaveValue('-price');
    await screen.findByText('1 événement');
    expect(cardTitles()).toEqual(['Nuit du jazz']);
    expect(Object.fromEntries(queries[0])).toMatchObject({
      q: 'lyon',
      category: 'concert',
      sort: '-price',
    });
  });

  it('ignore un tri inconnu dans l’URL', async () => {
    const queries = spyOnRequests();
    renderApp('/events?sort=titre');
    expect(await screen.findByText('15 événements')).toBeInTheDocument();
    expect(sortBy()).toHaveValue('date');
    expect(queries[0].has('sort')).toBe(false);
  });

  it('revient à la première page quand la recherche change', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/events?page=2');
    await screen.findByText('Page 2 sur 2');
    await user.type(search(), 'un');
    await waitFor(() => expect(router.state.location.search).toBe('?q=un'));
  });

  it('indique quand aucun événement ne correspond, et réinitialise recherche et tri', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/events?q=introuvable&sort=price');
    expect(
      await screen.findByText('Aucun événement ne correspond à ces filtres.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(await screen.findByText('15 événements')).toBeInTheDocument();
    expect(search()).toHaveValue('');
    expect(sortBy()).toHaveValue('date');
    expect(router.state.location.search).toBe('');
  });
});

describe('Accessibilité du catalogue (WCAG 2.2)', () => {
  it("propose un lien d'évitement vers le contenu principal (2.4.1)", async () => {
    renderApp('/events');
    await screen.findByText('15 événements');
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute(
      'href',
      '#contenu',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenu');
  });

  it("donne un titre propre à l'onglet (2.4.2)", async () => {
    renderApp('/events');
    await screen.findByText('15 événements');
    expect(document.title).toBe('Événements à venir – EventHub');
  });

  it('garde le focus sur la page quand le bouton de pagination devient inactif (2.4.3)', async () => {
    const user = userEvent.setup();
    renderApp('/events');
    await screen.findByText('15 événements');

    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    await screen.findByText('Page 2 sur 2');
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();
    expect(screen.getByRole('heading', { level: 1, name: 'Événements à venir' })).toHaveFocus();
  });
});
