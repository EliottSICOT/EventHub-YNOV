import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoUsers, mockAuth } from '../../mocks/auth';
import { mockEvents } from '../../mocks/events';
import { events } from '../../mocks/fixtures';
import { mockRegistrations } from '../../mocks/registrations';
import { renderApp } from '../../test/render';

const [, organizer] = demoUsers;
const DAY = 24 * 60 * 60 * 1000;
// Un événement avec des places : l'inscription ajoutée dans le test doit faire monter le compteur.
const upcoming = events.find((e) => e.organizer.id === organizer.id && !e.isFull)!;

describe('Tableau de bord organisateur (US12)', () => {
  it('refuse un participant', async () => {
    mockAuth.signIn('participant1@eventhub.test');
    renderApp('/organisateur');
    expect(await screen.findByText('Accès réservé')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mes événements' })).not.toBeInTheDocument();
  });

  it('liste mes événements, sépare à venir / passés, et ouvre les inscrits', async () => {
    const user = userEvent.setup();
    const past = {
      ...upcoming,
      id: 'past-camille',
      title: 'Soirée passée',
      startsAt: new Date(Date.now() - 2 * DAY).toISOString(),
      remainingSeats: upcoming.capacity - 3,
      isFull: false,
    };
    mockEvents.add(past);
    mockRegistrations.add(upcoming.id, demoUsers[0].id);
    mockAuth.signIn(organizer.email);

    renderApp('/organisateur');

    expect(await screen.findByRole('heading', { name: 'Mes événements' })).toBeInTheDocument();

    const upcomingSection = await screen.findByRole('region', { name: 'À venir' });
    const upcomingRow = within(upcomingSection)
      .getByRole('link', { name: upcoming.title })
      .closest('li')!;
    const registered = upcoming.capacity - upcoming.remainingSeats + 1;
    expect(upcomingRow).toHaveTextContent(
      `${registered} / ${upcoming.capacity} ${registered === 1 ? 'inscrit' : 'inscrits'}`,
    );

    const pastSection = screen.getByRole('region', { name: 'Passés' });
    expect(within(pastSection).getByRole('link', { name: 'Soirée passée' })).toBeInTheDocument();
    expect(pastSection).toHaveTextContent(`3 / ${past.capacity} inscrits`);

    await user.click(within(upcomingRow).getByRole('link', { name: 'Voir les inscrits' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: new RegExp(`Inscrits · ${upcoming.title}`) }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('columnheader', { name: 'Nom' })).toBeInTheDocument();
    expect(screen.getByText(demoUsers[0].lastName)).toBeInTheDocument();
    expect(screen.getByText(demoUsers[0].firstName)).toBeInTheDocument();
    expect(screen.getByText(demoUsers[0].email)).toBeInTheDocument();
  });
});
