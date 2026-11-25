import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { demoUsers, mockAuth } from '../../mocks/auth';
import { events } from '../../mocks/fixtures';
import { createHandlers } from '../../mocks/handlers';
import { mockRegistrations } from '../../mocks/registrations';
import { server } from '../../mocks/server';
import { renderApp } from '../../test/render';

const [participant, organizer] = demoUsers;
const DAY = 24 * 60 * 60 * 1000;
const mine = events.find((e) => e.organizer.id === organizer.id && !e.isFull)!;
const other = events.find((e) => e.organizer.id !== organizer.id && !e.isFull)!;

async function openMine() {
  mockAuth.signIn(organizer.email);
  const utils = renderApp(`/events/${mine.id}`);
  const remove = await screen.findByRole('button', { name: 'Supprimer' });
  return { ...utils, user: userEvent.setup(), remove };
}

describe("Suppression d'un événement (US09, Front)", () => {
  it("propose Modifier et Supprimer à l'organisateur de l'événement", async () => {
    await openMine();
    expect(screen.getByRole('link', { name: 'Modifier' })).toHaveAttribute(
      'href',
      `/organisateur/evenements/${mine.id}/modifier`,
    );
  });

  it.each([
    ['un visiteur', null, mine.id],
    ['un participant', participant.email, mine.id],
    ['un autre organisateur', organizer.email, other.id],
  ])('ne les propose pas à %s', async (_label, email, eventId) => {
    if (email) mockAuth.signIn(email);
    renderApp(`/events/${eventId}`);
    await screen.findByRole('heading', { level: 1 });
    await screen.findByRole(email ? 'button' : 'link', { name: "S'inscrire" });
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Modifier' })).not.toBeInTheDocument();
  });

  it('ne les propose plus pour un événement commencé', async () => {
    const past = { ...mine, startsAt: new Date(Date.now() - DAY).toISOString() };
    server.use(...createHandlers([past]));
    mockAuth.signIn(organizer.email);
    renderApp(`/events/${past.id}`);
    await screen.findByText(`Bonjour ${organizer.firstName}`);
    await screen.findByRole('button', { name: 'Événement terminé' });
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
  });

  it('demande une confirmation, et « Garder l’événement » ne supprime rien', async () => {
    const { user, remove } = await openMine();
    await user.click(remove);
    const dialog = await screen.findByRole('alertdialog', { name: 'Supprimer cet événement ?' });
    expect(within(dialog).getByText(mine.title)).toBeInTheDocument();
    const registered = mine.capacity - mine.remainingSeats;
    expect(dialog).toHaveTextContent(`Les ${registered} inscrits verront l'événement annulé.`);

    await user.click(within(dialog).getByRole('button', { name: "Garder l'événement" }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Événement annulé/)).not.toBeInTheDocument();
  });

  it("supprime après confirmation : l'événement est annulé et quitte le catalogue", async () => {
    const { user, remove, router } = await openMine();
    await user.click(remove);
    await user.click(await screen.findByRole('button', { name: 'Oui, supprimer' }));

    expect(await screen.findByText(/^Événement supprimé/)).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Événement annulé' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await router.navigate('/events');
    await screen.findByText('14 événements');
    expect(screen.queryByRole('link', { name: mine.title })).not.toBeInTheDocument();
  });

  it("affiche le refus de l'API et garde l'événement", async () => {
    server.use(
      http.delete('*/api/v1/events/:id', () =>
        HttpResponse.json(
          { statusCode: 409, message: 'Impossible de modifier ou de supprimer' },
          { status: 409 },
        ),
      ),
    );
    const { user, remove } = await openMine();
    await user.click(remove);
    await user.click(await screen.findByRole('button', { name: 'Oui, supprimer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de modifier ou de supprimer',
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeEnabled();
  });
});

describe('Événement annulé côté participant (US09, Front)', () => {
  const cancelled = { ...mine, isCancelled: true };

  beforeEach(() => {
    server.use(...createHandlers([cancelled]));
    mockAuth.signIn(participant.email);
  });

  it('marque l’inscription « Événement annulé », sans bouton Annuler', async () => {
    mockRegistrations.add(cancelled.id, participant.id);
    renderApp('/mes-inscriptions');
    const section = await screen.findByRole('region', { name: 'À venir' });
    expect(within(section).getByText('Événement annulé')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: cancelled.title })).toBeInTheDocument();
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
  });

  it("ferme les inscriptions sur le détail, sans bouton S'inscrire", async () => {
    renderApp(`/events/${cancelled.id}`);
    expect(await screen.findByRole('button', { name: 'Événement annulé' })).toBeDisabled();
    expect(screen.getByText(/les inscriptions sont fermées/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "S'inscrire" })).not.toBeInTheDocument();
  });

  it("n'affiche pas l'événement dans le catalogue", async () => {
    renderApp('/events');
    expect(await screen.findByText('Aucun événement')).toBeInTheDocument();
  });
});
