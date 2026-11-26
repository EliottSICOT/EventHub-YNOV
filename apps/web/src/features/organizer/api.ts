import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import { queryKeys } from '../../api/queries';
import type { CreateEventInput, EventDetail } from '../../api/types';
import { meQueryKey, useMe } from '../auth/api';

/** Préfixe commun : invalider cette clé recharge le tableau de bord, quel que soit l'utilisateur. */
export const myEventsKey = ['events', 'mine'] as const;

export const eventAttendeesKey = (eventId: string) =>
  ['events', 'attendees', eventId] as const;

/** Met le détail en cache et recharge les listes : le catalogue montre l'événement à jour. */
function refreshEvent(queryClient: QueryClient, event: EventDetail) {
  queryClient.setQueryData(queryKeys.event(event.id), event);
  void queryClient.invalidateQueries({
    queryKey: ['events'],
    predicate: (query) => query.queryKey[1] !== 'detail',
  });
  void queryClient.invalidateQueries({ queryKey: myEventsKey });
}

/**
 * Événements de l'organisateur connecté (US12), passés compris.
 * La clé porte l'identifiant de l'utilisateur : après un changement de compte,
 * le cache du précédent n'est jamais affiché.
 */
export function useMyEvents() {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  return useQuery({
    queryKey: [...myEventsKey, user?.id],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const result = await api.GET('/api/v1/events/mine', { signal });
      if (result.response.status === 401) queryClient.setQueryData(meQueryKey, null);
      return unwrap(result);
    },
  });
}

/** Inscrits d'un événement, réservé à son organisateur (US12). */
export function useEventAttendees(eventId: string) {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  return useQuery({
    queryKey: [...eventAttendeesKey(eventId), user?.id],
    enabled: Boolean(user) && Boolean(eventId),
    queryFn: async ({ signal }) => {
      const result = await api.GET('/api/v1/events/{id}/registrations', {
        params: { path: { id: eventId } },
        signal,
      });
      if (result.response.status === 401) queryClient.setQueryData(meQueryKey, null);
      return unwrap(result);
    },
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
