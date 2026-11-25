import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { EventDetail } from '../../api/types';
import { demoUsers, mockAuth } from '../../mocks/auth';
import { events } from '../../mocks/fixtures';
import { createHandlers } from '../../mocks/handlers';
import { mockRegistrations } from '../../mocks/registrations';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';
import { centsToEuros, eurosToCents, toEventFormValues, toLocalDateTimeInput } from './eventForm';

const [participant, organizer] = demoUsers;
const DAY = 24 * 60 * 60 * 1000;
const mine = events.find((e) => e.organizer.id === organizer.id && !e.isFull)!;
const other = events.find((e) => e.organizer.id !== organizer.id)!;
const pageOf = (event: EventDetail) => `/organisateur/evenements/${event.id}/modifier`;

async function open(event = mine) {
  mockAuth.signIn(organizer.email);
  const utils = renderApp(pageOf(event));
  await screen.findByRole('form', { name: "Modifier l'événement" });
  await screen.findByRole('option', { name: 'Concert' });
  return { ...utils, user: userEvent.setup({ applyAccept: false }) };
}

async function replace(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  await user.clear(screen.getByLabelText(label));
  if (value) await user.type(screen.getByLabelText(label), value);
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

describe("Modification d'un événement (US09, Front)", () => {
  it("préremplit le formulaire avec l'événement", async () => {
    await open();
    expect(screen.getByLabelText('Titre')).toHaveValue(mine.title);
    expect(screen.getByLabelText('Description')).toHaveValue(mine.description);
    expect(screen.getByLabelText('Catégorie')).toHaveValue(mine.category.id);
    expect(screen.getByLabelText('Date et heure de début')).toHaveValue(
      toLocalDateTimeInput(new Date(mine.startsAt)),
    );
    expect(screen.getByLabelText('Lieu')).toHaveValue(mine.venue);
    expect(screen.getByLabelText('Adresse (facultatif)')).toHaveValue(mine.address);
    expect(screen.getByLabelText('Ville')).toHaveValue(mine.city);
    expect(screen.getByLabelText('Capacité')).toHaveValue(mine.capacity);
  });

  it('enregistre, confirme sur le détail et met le catalogue à jour', async () => {
    const { user, router } = await open();
    await replace(user, 'Titre', 'Titre modifié');
    await replace(user, 'Prix (€)', '12,50');
    await save(user);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/events/${mine.id}`));
    expect(await screen.findByText('Événement modifié.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Titre modifié' })).toBeInTheDocument();
    expect(screen.getByText(/^12,50\s€$/)).toBeInTheDocument();

    await router.navigate('/events');
    expect(await screen.findByRole('link', { name: 'Titre modifié' })).toBeInTheDocument();
  });

  it('reprend les validations de la création', async () => {
    const { user } = await open();
    await replace(user, 'Titre', '');
    fireEvent.change(screen.getByLabelText('Date et heure de début'), {
      target: { value: toLocalDateTimeInput(new Date(Date.now() - DAY)) },
    });
    await replace(user, 'Capacité', '0');
    await save(user);

    expect(await screen.findByText('Le titre est obligatoire')).toBeInTheDocument();
    expect(screen.getByText('La date de début doit être dans le futur')).toBeInTheDocument();
    expect(screen.getByText("La capacité doit être d'au moins 1 place")).toBeInTheDocument();
  });

  it("affiche sous le champ le refus d'une capacité inférieure au nombre d'inscrits", async () => {
    const registered = mine.capacity - mine.remainingSeats + 1;
    mockRegistrations.add(mine.id, participant.id);
    const { user, router } = await open();
    await replace(user, 'Capacité', String(registered - 1));
    await save(user);

    expect(await screen.findByLabelText('Capacité')).toHaveAccessibleDescription(
      expect.stringContaining(
        `La capacité ne peut pas être inférieure au nombre d'inscrits (${registered})`,
      ),
    );
    expect(router.state.location.pathname).toBe(pageOf(mine));
  });

  it("signale l'échec de l'image sans perdre la modification", async () => {
    server.use(
      http.post('*/api/v1/events/:id/image', () =>
        HttpResponse.json({ statusCode: 500, message: 'Stockage indisponible' }, { status: 500 }),
      ),
    );
    const { user } = await open();
    await user.upload(
      screen.getByLabelText('Image (facultatif)'),
      new File([new Uint8Array(16)], 'affiche.png', { type: 'image/png' }),
    );
    await save(user);

    expect(await screen.findByText('Événement modifié.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "L'événement est bien modifié, mais l'image n'a pas été enregistrée : Stockage indisponible",
    );
  });

  it("refuse l'événement d'un autre organisateur", async () => {
    mockAuth.signIn(organizer.email);
    renderApp(pageOf(other));
    expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('refuse un participant, et redirige un visiteur vers la connexion', async () => {
    mockAuth.signIn(participant.email);
    const { unmount } = renderApp(pageOf(mine));
    expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
    unmount();

    mockAuth.signOut();
    const { router } = renderApp(pageOf(mine));
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
  });

  it.each([
    ['annulé', { isCancelled: true }, 'Événement annulé'],
    [
      'commencé',
      { startsAt: new Date(Date.now() - DAY).toISOString(), endsAt: null },
      'Événement commencé',
    ],
  ])('refuse un événement %s', async (_label, changes, message) => {
    const event = { ...mine, ...changes };
    server.use(...createHandlers([event]));
    mockAuth.signIn(organizer.email);
    renderApp(pageOf(event));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('affiche un événement introuvable', async () => {
    mockAuth.signIn(organizer.email);
    renderApp('/organisateur/evenements/inconnu/modifier');
    expect(await screen.findByText('Événement introuvable')).toBeInTheDocument();
  });
});

describe('Valeurs du formulaire à partir d’un événement (US09)', () => {
  it.each([
    [0, '0'],
    [1200, '12'],
    [1250, '12,50'],
    [1205, '12,05'],
    [1_000_000, '10000'],
  ])('%i centimes donnent « %s », et inversement', (cents, euros) => {
    expect(centsToEuros(cents)).toBe(euros);
    expect(eurosToCents(euros)).toBe(cents);
  });

  it('laisse vides les champs facultatifs absents', () => {
    expect(toEventFormValues({ ...mine, endsAt: null, address: null })).toMatchObject({
      endsAt: '',
      address: '',
    });
  });
});
