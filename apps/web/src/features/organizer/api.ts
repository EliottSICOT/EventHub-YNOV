import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import { queryKeys } from '../../api/queries';
import type { CreateEventInput, EventDetail } from '../../api/types';

/** Met le détail en cache et recharge les listes : le catalogue montre l'événement à jour. */
function refreshEvent(queryClient: QueryClient, event: EventDetail) {
  queryClient.setQueryData(queryKeys.event(event.id), event);
  void queryClient.invalidateQueries({
    queryKey: ['events'],
    predicate: (query) => query.queryKey[1] !== 'detail',
  });
}

/** Crée un événement au nom de l'organisateur connecté (US08). */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEventInput) =>
      unwrap(await api.POST('/api/v1/events', { body: input })),
    onSuccess: (event) => refreshEvent(queryClient, event),
  });
}

/** Envoie l'image d'un événement en multipart (champ `image`). */
export function useUploadEventImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, file }: { eventId: string; file: File }) => {
      const form = new FormData();
      form.append('image', file);
      return unwrap(
        await api.POST('/api/v1/events/{id}/image', {
          params: { path: { id: eventId } },
          // openapi-fetch transmet un FormData tel quel : le navigateur pose le Content-Type multipart.
          body: form as unknown as { image: string },
        }),
      );
    },
    onSuccess: (event) => refreshEvent(queryClient, event),
  });
}
