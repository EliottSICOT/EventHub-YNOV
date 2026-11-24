import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../../api/client';
import { queryKeys } from '../../api/queries';
import type { EventDetail } from '../../api/types';
import { meQueryKey, useMe } from '../auth/api';

const REGISTRATIONS_KEY = 'my-registrations';

/**
 * Inscriptions de l'utilisateur connecté, à venir et passées (US07).
 * La clé porte l'identifiant de l'utilisateur : après un changement de compte,
 * le cache du précédent n'est jamais affiché.
 */
export function useMyRegistrations() {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  return useQuery({
    queryKey: [REGISTRATIONS_KEY, user?.id],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const result = await api.GET('/api/v1/me/registrations', { signal });
      // Session expirée : oublier l'utilisateur, `RequireAuth` renvoie alors vers la connexion.
      if (result.response.status === 401) queryClient.setQueryData(meQueryKey, null);
      return unwrap(result);
    },
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
      void queryClient.invalidateQueries({ queryKey: [REGISTRATIONS_KEY] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}
