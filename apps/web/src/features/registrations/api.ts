import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import { queryKeys } from '../../api/queries';
import type { EventDetail } from '../../api/types';

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
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}
