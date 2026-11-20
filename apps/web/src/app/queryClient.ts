import { QueryClient } from '@tanstack/react-query';
import { shouldRetry } from '../api/queries';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });
}
