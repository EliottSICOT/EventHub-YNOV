import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { events } from '../../mocks/fixtures';
import { renderApp } from '../../test/render';

describe("Détail d'un événement (US03)", () => {
  it('affiche description, organisateur, date, lieu et places restantes', async () => {
    const event = events[1];
    renderApp(`/events/${event.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: event.title })).toBeInTheDocument();
    expect(screen.getByText(event.description)).toBeInTheDocument();
    expect(screen.getByText(event.organizer.name)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(event.venue))).toBeInTheDocument();
    expect(screen.getByText(`${event.remainingSeats} places restantes`)).toBeInTheDocument();
    expect(screen.getByText(`sur ${event.capacity}`)).toBeInTheDocument();
  });

  it('affiche « Complet » pour un événement complet', async () => {
    const full = events.find((e) => e.isFull)!;
    renderApp(`/events/${full.id}`);
    expect(await screen.findByText('Complet')).toBeInTheDocument();
  });

  it('affiche un message clair pour un identifiant inconnu (404)', async () => {
    renderApp('/events/inconnu');
    expect(await screen.findByText('Événement introuvable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Retour aux événements' })).toHaveAttribute(
      'href',
      '/events',
    );
  });

  it('ouvre le détail depuis la liste', async () => {
    const user = userEvent.setup();
    renderApp('/events');
    await user.click(await screen.findByRole('link', { name: events[2].title }));
    expect(
      await screen.findByRole('heading', { level: 1, name: events[2].title }),
    ).toBeInTheDocument();
  });
});
