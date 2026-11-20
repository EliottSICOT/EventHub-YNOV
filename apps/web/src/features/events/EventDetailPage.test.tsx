import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHandlers } from '../../mocks/handlers';
import { events } from '../../mocks/fixtures';
import { server } from '../../mocks/server';
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

  it('affiche le prix, ou « Gratuit »', async () => {
    const paid = events.find((e) => e.priceCents === 2500)!;
    const { unmount } = renderApp(`/events/${paid.id}`);
    expect(await screen.findByText(/^25,00\s€$/)).toBeInTheDocument();
    unmount();

    const free = events.find((e) => e.priceCents === 0)!;
    renderApp(`/events/${free.id}`);
    expect(await screen.findByText('Gratuit')).toBeInTheDocument();
  });

  it("affiche l'image de l'événement quand elle existe", async () => {
    server.use(...createHandlers([{ ...events[1], imageUrl: '/images/meetup.jpg' }]));
    renderApp(`/events/${events[1].id}`);
    expect(
      await screen.findByRole('img', { name: `Visuel de ${events[1].title}` }),
    ).toHaveAttribute('src', '/images/meetup.jpg');
  });

  it('remplace le bouton par « Complet » pour un événement complet', async () => {
    const full = events.find((e) => e.isFull)!;
    renderApp(`/events/${full.id}`);
    expect(await screen.findByRole('button', { name: 'Complet' })).toBeDisabled();
  });

  it("n'affiche pas « Complet » quand il reste des places", async () => {
    renderApp(`/events/${events[1].id}`);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Complet' })).not.toBeInTheDocument();
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
