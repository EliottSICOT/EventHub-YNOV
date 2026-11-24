import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, unwrap } from '../../api/client';
import { queryKeys } from '../../api/queries';
import type { ApiErrorBody, EventDetail } from '../../api/types';

export const myRegistrationsKey = ['registrations', 'me'] as const;

/** Inscriptions de l'utilisateur connecté, passées comprises (US06). */
export function useMyRegistrations() {
  return useQuery({
    queryKey: myRegistrationsKey,
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/registrations/me', { signal })),
  });
}

/**
 * Inscrit l'utilisateur connecté à l'événement `eventId` (US05).
 * Au succès, la réponse de l'API met à jour la jauge du détail sans nouvel appel,
 * et les listes sont invalidées pour afficher les places restantes à jour.
 * Après un refus (409 : complet, déjà inscrit, passé), l'événement est rechargé.
 */
export function useRegister(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/events/{id}/registrations', {
          params: { path: { id: eventId } },
        }),
      ),
    onSuccess: ({ remainingSeats, isFull }) => {
      queryClient.setQueryData<EventDetail>(queryKeys.event(eventId), (event) =>
        event ? { ...event, remainingSeats, isFull } : event,
      );
      void queryClient.invalidateQueries({
        queryKey: ['events'],
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
      void queryClient.invalidateQueries({ queryKey: myRegistrationsKey });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}

/**
 * Annule l'inscription `registrationId` (US06). La place est libérée côté API :
 * on recharge la liste des inscriptions et tous les événements (jauges des listes et des détails).
 */
export function useCancelRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { response, error } = await api.DELETE('/api/v1/registrations/{id}', {
        params: { path: { id: registrationId } },
      });
      // 204 sans corps : `unwrap` n'est pas adapté.
      if (!response.ok) throw new ApiError(response.status, error as ApiErrorBody | undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    // Succès ou refus (403, 404, 409), la liste doit refléter l'état réel.
    onSettled: () => queryClient.invalidateQueries({ queryKey: myRegistrationsKey }),
  });
}
