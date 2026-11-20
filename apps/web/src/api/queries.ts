import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, ApiError, unwrap } from './client';
import { PAGE_SIZE, type EventFilters } from '../features/events/filters';

export const queryKeys = {
  events: (filters: EventFilters) => ['events', filters] as const,
  event: (id: string) => ['events', 'detail', id] as const,
  categories: ['categories'] as const,
};

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: queryKeys.events(filters),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/v1/events', {
          params: { query: { ...filters, pageSize: PAGE_SIZE } },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.event(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/events/{id}', { params: { path: { id } }, signal })),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/categories', { signal })),
    staleTime: 5 * 60 * 1000,
  });
}

/** Pas de nouvel essai sur les erreurs 4xx : elles ne se corrigeront pas toutes seules. */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}
