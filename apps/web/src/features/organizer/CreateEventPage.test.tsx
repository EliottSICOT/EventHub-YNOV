import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { mockAuth } from '../../mocks/auth';
import { mockEvents } from '../../mocks/events';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';
import { toLocalDateTimeInput } from './eventForm';

const PAGE = '/organisateur/evenements/nouveau';
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => toLocalDateTimeInput(new Date(Date.now() + days * DAY));

const file = (content: BlobPart, name: string, type: string) => new File([content], name, { type });
const png = (bytes = 1024) => file(new Uint8Array(bytes), 'affiche.png', 'image/png');

/** Compte les appels à un endpoint pendant le test. */
function countRequests(method: string, pathname: RegExp) {
  const calls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const path = new URL(request.url).pathname;
    if (request.method === method && pathname.test(path)) calls.push(path);
  });
  return calls;
}

async function openAsOrganizer() {
  mockAuth.signIn('camille@eventhub.test');
  const utils = renderApp(PAGE);
  await screen.findByRole('form', { name: 'Créer un événement' });
  // Catégories chargées depuis l'API (mock).
  await screen.findByRole('option', { name: 'Concert' });
  return utils;
}

interface Values {
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  city: string;
  price: string;
  capacity: string;
}

const valid: Values = {
  title: 'Soirée slam',
  description: 'Trois quartets sur scène.',
  category: 'Concert',
  startsAt: inDays(10),
  endsAt: '',
  venue: 'Le Transbordeur',
  address: '',
  city: 'Lyon',
  price: '12,50',
  capacity: '300',
};

async function fill(values: Partial<Values> = {}, image?: File) {
  const user = userEvent.setup({ applyAccept: false });
  const v = { ...valid, ...values };
  if (v.title) await user.type(screen.getByLabelText('Titre'), v.title);
  if (v.description) await user.type(screen.getByLabelText('Description'), v.description);
  if (v.category) await user.selectOptions(screen.getByLabelText('Catégorie'), v.category);
  // Les champs datetime-local ne se saisissent pas caractère par caractère dans jsdom.
  if (v.startsAt)
    fireEvent.change(screen.getByLabelText('Date et heure de début'), {
      target: { value: v.startsAt },
    });
  if (v.endsAt)
    fireEvent.change(screen.getByLabelText('Date et heure de fin (facultatif)'), {
      target: { value: v.endsAt },
    });
  if (v.venue) await user.type(screen.getByLabelText('Lieu'), v.venue);
  if (v.address) await user.type(screen.getByLabelText('Adresse (facultatif)'), v.address);
  if (v.city) await user.type(screen.getByLabelText('Ville'), v.city);
  if (v.price) await user.type(screen.getByLabelText('Prix (€)'), v.price);
  if (v.capacity) await user.type(screen.getByLabelText('Capacité'), v.capacity);
  if (image) await user.upload(screen.getByLabelText('Image (facultatif)'), image);
  return user;
}

async function submit(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: "Créer l'événement" }));
}

/** Le champ est en erreur, et son message lui est relié pour les lecteurs d'écran. */
async function expectFieldError(label: string, message: string) {
  const field = screen.getByLabelText(label);
  const error = await screen.findByText(message);
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveAccessibleDescription(expect.stringContaining(error.textContent!));
}

describe('Création d’un événement (US08)', () => {
  afterEach(() => server.events.removeAllListeners());

  describe('accès', () => {
    it('refuse la page à un participant, sans afficher le formulaire', async () => {
      mockAuth.signIn('participant1@eventhub.test');
      renderApp(PAGE);

      expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
      expect(screen.getByText('Cette page est réservée aux organisateurs.')).toBeInTheDocument();
      expect(screen.queryByRole('form', { name: 'Créer un événement' })).not.toBeInTheDocument();
    });

    it('envoie un visiteur non connecté vers la connexion', async () => {
      const { router } = renderApp(PAGE);
      await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
      expect(router.state.location.search).toBe(`?redirect=${encodeURIComponent(PAGE)}`);
    });

    it('montre le lien « Créer un événement » à un organisateur seulement', async () => {
      mockAuth.signIn('camille@eventhub.test');
      const { unmount } = renderApp('/events');
      const link = await screen.findByRole('link', { name: 'Créer un événement' });
      expect(link).toHaveAttribute('href', PAGE);
      unmount();

      mockAuth.signIn('participant1@eventhub.test');
      renderApp('/events');
      await screen.findByText('Bonjour Participant');
      expect(screen.queryByRole('link', { name: 'Créer un événement' })).not.toBeInTheDocument();
    });
  });

  describe('validation côté Front', () => {
    it("signale les champs obligatoires sans appeler l'API et place le focus sur le premier", async () => {
      const calls = countRequests('POST', /^\/api\/v1\/events$/);
      await openAsOrganizer();

      await submit();

      await expectFieldError('Titre', 'Le titre est obligatoire');
      await expectFieldError('Description', 'La description est obligatoire');
      await expectFieldError('Catégorie', 'La catégorie est obligatoire');
      await expectFieldError('Date et heure de début', 'La date de début est obligatoire');
      await expectFieldError('Lieu', 'Le lieu est obligatoire');
      await expectFieldError('Ville', 'La ville est obligatoire');
      await expectFieldError('Prix (€)', 'Le prix est obligatoire (0 pour un événement gratuit)');
      await expectFieldError('Capacité', 'La capacité est obligatoire');
      expect(screen.getByLabelText('Titre')).toHaveFocus();
      expect(calls).toEqual([]);
    });

    it('refuse une date passée, une capacité à 0 et un prix négatif', async () => {
      const calls = countRequests('POST', /^\/api\/v1\/events$/);
      await openAsOrganizer();

      const user = await fill({ startsAt: inDays(-1), capacity: '0', price: '-5' });
      await submit(user);

      await expectFieldError('Date et heure de début', 'La date de début doit être dans le futur');
      await expectFieldError('Capacité', "La capacité doit être d'au moins 1 place");
      await expectFieldError('Prix (€)', 'Le prix doit être positif ou nul');
      expect(screen.getByLabelText('Date et heure de début')).toHaveFocus();
      expect(calls).toEqual([]);
    });

    it('refuse une fin antérieure au début et un titre trop court', async () => {
      await openAsOrganizer();

      const user = await fill({ title: 'Ab', startsAt: inDays(10), endsAt: inDays(9) });
      await submit(user);

      await expectFieldError('Titre', 'Le titre doit contenir au moins 3 caractères');
      await expectFieldError(
        'Date et heure de fin (facultatif)',
        'La date de fin doit être postérieure à la date de début',
      );
    });

    it("retire l'erreur d'un champ dès qu'il est corrigé", async () => {
      await openAsOrganizer();
      const user = userEvent.setup();
      await submit(user);
      await screen.findByText('Le lieu est obligatoire');

      await user.type(screen.getByLabelText('Lieu'), 'Le Transbordeur');

      expect(screen.queryByText('Le lieu est obligatoire')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Lieu')).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('image', () => {
    it("refuse une image qui n'est ni JPG ni PNG, sans rien envoyer", async () => {
      const calls = countRequests('POST', /^\/api\/v1\/events/);
      await openAsOrganizer();

      const user = await fill({}, file('GIF89a', 'anim.gif', 'image/gif'));
      await submit(user);

      await expectFieldError('Image (facultatif)', "L'image doit être au format JPG ou PNG");
      expect(screen.getByLabelText('Image (facultatif)')).toHaveFocus();
      expect(calls).toEqual([]);
    });

    it('refuse une image de plus de 2 Mo, sans rien envoyer', async () => {
      const calls = countRequests('POST', /^\/api\/v1\/events/);
      await openAsOrganizer();

      const user = await fill({}, png(2 * 1024 * 1024 + 1));
      await submit(user);

      await expectFieldError('Image (facultatif)', "L'image ne doit pas dépasser 2 Mo");
      expect(calls).toEqual([]);
    });
  });

  describe('erreurs du serveur', () => {
    it('affiche les `details` d’une 400 sous les bons champs', async () => {
      server.use(
        http.post('*/api/v1/events', () =>
          HttpResponse.json(
            {
              statusCode: 400,
              error: 'Bad Request',
              message: 'La requête contient des champs invalides',
              details: [
                { field: 'categoryId', message: "La catégorie choisie n'existe pas" },
                { field: 'startsAt', message: 'La date de début doit être dans le futur' },
              ],
              path: '/api/v1/events',
              timestamp: new Date().toISOString(),
            },
            { status: 400 },
          ),
        ),
      );
      await openAsOrganizer();

      const user = await fill();
      await submit(user);

      await expectFieldError('Catégorie', "La catégorie choisie n'existe pas");
      await expectFieldError('Date et heure de début', 'La date de début doit être dans le futur');
      expect(screen.getByLabelText('Catégorie')).toHaveFocus();
    });

    it('affiche un refus 403 en message général', async () => {
      server.use(
        http.post('*/api/v1/events', () =>
          HttpResponse.json(
            {
              statusCode: 403,
              error: 'Forbidden',
              message: "Vous n'avez pas les droits nécessaires pour cette action",
              path: '/api/v1/events',
              timestamp: new Date().toISOString(),
            },
            { status: 403 },
          ),
        ),
      );
      await openAsOrganizer();

      const user = await fill();
      await submit(user);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Vous n'avez pas les droits nécessaires pour cette action");
      expect(alert).toHaveFocus();
    });
  });

  describe('création réussie', () => {
    it('crée l’événement, ouvre son détail et le montre dans le catalogue', async () => {
      const { router } = await openAsOrganizer();

      const user = await fill({ address: '3 boulevard de Stalingrad' });
      await submit(user);

      await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/events\/[\w-]+$/));
      expect(await screen.findByRole('heading', { name: 'Soirée slam' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Événement créé');
      expect(screen.getByText('12,50 €')).toBeInTheDocument();

      const [created] = mockEvents.all();
      expect(created).toMatchObject({
        title: 'Soirée slam',
        priceCents: 1250,
        capacity: 300,
        address: '3 boulevard de Stalingrad',
        endsAt: null,
        organizer: { name: 'Camille Martin' },
      });
      expect(Date.parse(created.startsAt)).toBe(new Date(valid.startsAt).getTime());

      await user.click(screen.getByRole('link', { name: '← Retour aux événements' }));
      expect(await screen.findByRole('link', { name: 'Soirée slam' })).toBeInTheDocument();
    });

    it("envoie l'image après la création, puis l'affiche sur le détail", async () => {
      const imageCalls = countRequests('POST', /^\/api\/v1\/events\/[\w-]+\/image$/);
      const { router } = await openAsOrganizer();

      const user = await fill({ price: '0' }, png());
      await submit(user);

      await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/events\/[\w-]+$/));
      expect(await screen.findByRole('img', { name: 'Visuel de Soirée slam' })).toBeInTheDocument();
      expect(imageCalls).toEqual([`/api/v1/events/${mockEvents.all()[0].id}/image`]);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it("garde l'événement et le signale sur le détail si l'image est refusée", async () => {
      server.use(
        http.post('*/api/v1/events/:id/image', ({ request }) =>
          HttpResponse.json(
            {
              statusCode: 400,
              error: 'Bad Request',
              message: 'La requête contient des champs invalides',
              details: [{ field: 'image', message: "L'image doit être au format JPG ou PNG" }],
              path: new URL(request.url).pathname,
              timestamp: new Date().toISOString(),
            },
            { status: 400 },
          ),
        ),
      );
      const { router } = await openAsOrganizer();

      const user = await fill({}, png());
      await submit(user);

      await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/events\/[\w-]+$/));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        "L'événement est bien créé, mais l'image n'a pas été enregistrée : L'image doit être au format JPG ou PNG",
      );
      expect(screen.getByRole('heading', { name: 'Soirée slam' })).toBeInTheDocument();
      expect(mockEvents.all()).toHaveLength(1);
    });
  });
});
