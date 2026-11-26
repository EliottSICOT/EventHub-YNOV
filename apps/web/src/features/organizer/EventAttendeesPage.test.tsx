import { screen, waitFor } from '@testing-library/react';
import { mockAuth } from '../../mocks/auth';
import { events } from '../../mocks/fixtures';
import { mockRegistrations } from '../../mocks/registrations';
import { renderApp } from '../../test/render';
import { formatDateTime } from '../events/format';

const participantId = '0d6a1b52-1b0e-4b8e-9a43-0d7f1e2b9c01';
const event = events.find((e) => e.organizer.name === 'Camille Martin')!;
const PAGE = `/organisateur/evenements/${event.id}/inscrits`;

describe('Liste des inscrits (US12, Front)', () => {
  it('redirige un visiteur vers la connexion', async () => {
    const { router } = renderApp(PAGE);
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'));
  });

  it('refuse un participant', async () => {
    mockAuth.signIn('participant1@eventhub.test');
    renderApp(PAGE);
    expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
  });

  it("affiche nom, prénom, email et date d'inscription", async () => {
    mockAuth.signIn('camille@eventhub.test');
    const registration = mockRegistrations.add(event.id, participantId);
    renderApp(PAGE);

    expect(await screen.findByRole('columnheader', { name: 'Nom' })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Participant')).toBeInTheDocument();
    expect(screen.getByText('participant1@eventhub.test')).toBeInTheDocument();
    expect(screen.getByText(formatDateTime(registration.createdAt))).toBeInTheDocument();
  });

  it('signale une liste vide', async () => {
    mockAuth.signIn('camille@eventhub.test');
    renderApp(PAGE);
    expect(await screen.findByText('Aucun inscrit pour le moment')).toBeInTheDocument();
  });
});
