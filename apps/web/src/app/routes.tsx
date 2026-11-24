import { Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from '../features/auth/RequireAuth';
import { SignInPage } from '../features/auth/SignInPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { EventDetailPage } from '../features/events/EventDetailPage';
import { EventListPage } from '../features/events/EventListPage';
import { MyRegistrationsPage } from '../features/registrations/MyRegistrationsPage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

/**
 * Routes protégées : les placer sous un élément `RequireAuth`
 * (`features/auth/RequireAuth.tsx`), avec `role="ORGANIZER"` pour les écrans organisateur.
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
        children: [{ path: 'me/registrations', element: <MyRegistrationsPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
