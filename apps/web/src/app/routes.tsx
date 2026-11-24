import { Navigate, type RouteObject } from 'react-router';
import { SignInPage } from '../features/auth/SignInPage';
import { SignUpPage } from '../features/auth/SignUpPage';
import { EventDetailPage } from '../features/events/EventDetailPage';
import { EventListPage } from '../features/events/EventListPage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

/**
 * Routes protégées (à venir) : les placer sous un élément `RequireAuth`
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
