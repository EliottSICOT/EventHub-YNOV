import { Navigate, type RouteObject } from 'react-router';
import { RequireAuth, RequireOrganizer } from '../features/auth/RequireAuth';
import { SignInPage } from '../features/auth/SignInPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { EventDetailPage } from '../features/events/EventDetailPage';
import { EventListPage } from '../features/events/EventListPage';
import { CreateEventPage } from '../features/organizer/CreateEventPage';
import { EventAttendeesPage } from '../features/organizer/EventAttendeesPage';
import { OrganizerDashboardPage } from '../features/organizer/OrganizerDashboardPage';
import { MyRegistrationsPage } from '../features/registrations/MyRegistrationsPage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

/**
 * Routes protégées : sous un élément `RequireAuth` (`features/auth/RequireAuth.tsx`),
 * ou `RequireOrganizer` pour les écrans organisateur.
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/events" replace /> },
      { path: 'events', element: <EventListPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },
      { path: 'connexion', element: <SignInPage /> },
      { path: 'inscription', element: <SignUpPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'mes-inscriptions', element: <MyRegistrationsPage /> },
          // Adresse citée par les critères d'US07.
          { path: 'me/registrations', element: <Navigate to="/mes-inscriptions" replace /> },
        ],
      },
      {
        element: <RequireOrganizer />,
        children: [
          { path: 'organisateur/evenements', element: <OrganizerDashboardPage /> },
          { path: 'organisateur/evenements/nouveau', element: <CreateEventPage /> },
          { path: 'organisateur/evenements/:id/inscrits', element: <EventAttendeesPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
