import { Navigate, type RouteObject } from 'react-router';
import { EventDetailPage } from '../features/events/EventDetailPage';
import { EventListPage } from '../features/events/EventListPage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/events" replace /> },
      { path: 'events', element: <EventListPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
