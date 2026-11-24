import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { routes as appRoutes } from '../app/routes';

/**
 * Rend l'application sur une URL donnée, avec un cache de requêtes neuf.
 * `routes` permet de tester un élément (une garde de route…) sur des routes propres au test.
 */
export function renderApp(url: string, routes: RouteObject[] = appRoutes) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
