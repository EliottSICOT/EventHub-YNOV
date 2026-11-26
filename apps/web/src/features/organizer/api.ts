import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, ApiError, unwrap } from '../../api/client';
import { queryKeys } from '../../api/queries';
import type { ApiErrorBody, CreateEventInput, EventDetail } from '../../api/types';
import { meQueryKey, useMe } from '../auth/api';
import { myRegistrationsKey } from '../registrations/api';

/** Préfixe commun : invalider cette clé recharge le tableau de bord, quel que soit l'utilisateur. */
export const myEventsKey = ['events', 'me'] as const;

/** Met le détail en cache et recharge les listes : le catalogue montre l'événement à jour. */
function refreshEvent(queryClient: QueryClient, event: EventDetail) {
  queryClient.setQueryData(queryKeys.event(event.id), event);
  void queryClient.invalidateQueries({
    queryKey: ['events'],
    predicate: (query) => query.queryKey[1] !== 'detail',
  });
  void queryClient.invalidateQueries({ queryKey: myEventsKey });
}

/** Événements de l'organisateur connecté, passés compris (US12). */
export function useMyEvents() {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  return useQuery({
    queryKey: [...myEventsKey, user?.id],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const result = await api.GET('/api/v1/events/me', { signal });
      if (result.response.status === 401) queryClient.setQueryData(meQueryKey, null);
      return unwrap(result);
    },
  });
}

/** Inscrits d'un événement, réservé à son organisateur (US12). */
export function useEventRegistrants(eventId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['events', eventId, 'registrants'] as const,
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

/** Modifie un événement (US09) : catalogue, détail et « Mes inscriptions » sont mis à jour. */
export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEventInput) =>
      unwrap(
        await api.PUT('/api/v1/events/{id}', { params: { path: { id: eventId } }, body: input }),
      ),
    onSuccess: (event) => {
      refreshEvent(queryClient, event);
      void queryClient.invalidateQueries({ queryKey: myRegistrationsKey });
    },
  });
}

/** Supprime un événement (US09) : il quitte le catalogue, son détail devient « annulé ». */
export function useDeleteEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { response, error } = await api.DELETE('/api/v1/events/{id}', {
        params: { path: { id: eventId } },
      });
      // 204 sans corps : `unwrap` n'est pas adapté.
      if (!response.ok) throw new ApiError(response.status, error as ApiErrorBody | undefined);
    },
    onSuccess: () => {
      queryClient.setQueryData<EventDetail>(queryKeys.event(eventId), (event) =>
        event ? { ...event, isCancelled: true } : event,
      );
      void queryClient.invalidateQueries({ queryKey: myRegistrationsKey });
      void queryClient.invalidateQueries({ queryKey: myEventsKey });
    },
    // Succès ou refus (403, 404, 409), le détail et le catalogue doivent refléter l'état réel.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
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

/** Raison, à afficher, de l'échec de l'envoi de l'image. */
export function imageErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.body?.details?.[0]?.message ?? error.message;
  return 'Impossible de contacter le serveur.';
}
