import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './app/queryClient';
import { routes } from './app/routes';
import './index.css';

/** VITE_API_MOCKS=true : le Front tourne sur les mocks MSW, sans API. */
async function enableMocks() {
  if (import.meta.env.VITE_API_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledFrame: 'bypass' });
}

await enableMocks();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </QueryClientProvider>
  </StrictMode>,
);
