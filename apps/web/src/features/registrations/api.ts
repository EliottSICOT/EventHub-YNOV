import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, unwrap } from '../../api/client';
import { queryKeys } from '../../api/queries';
import type { ApiErrorBody, EventDetail } from '../../api/types';
import { meQueryKey, useMe } from '../auth/api';

/** Préfixe commun : invalider cette clé recharge la liste, quel que soit l'utilisateur. */
export const myRegistrationsKey = ['registrations', 'me'] as const;
export const myWaitlistKey = ['waitlist', 'me'] as const;

/**
 * Inscriptions de l'utilisateur connecté, passées comprises (US06, US07).
 * La clé porte l'identifiant de l'utilisateur : après un changement de compte,
 * le cache du précédent n'est jamais affiché.
 */
export function useMyRegistrations() {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  return useQuery({
    queryKey: [...myRegistrationsKey, user?.id],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const result = await api.GET('/api/v1/registrations/me', { signal });
      // Session expirée : oublier l'utilisateur, `RequireAuth` renvoie alors vers la connexion.
      if (result.response.status === 401) queryClient.setQueryData(meQueryKey, null);
      return unwrap(result);
    },
  });
}

/** Listes d'attente de l'utilisateur connecté, avec position (US14). */
export function useMyWaitlist() {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  return useQuery({
    queryKey: [...myWaitlistKey, user?.id],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const result = await api.GET('/api/v1/waitlist/me', { signal });
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
      void queryClient.invalidateQueries({ queryKey: myRegistrationsKey });
      void queryClient.invalidateQueries({ queryKey: myWaitlistKey });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}

/** Rejoint la liste d'attente d'un événement complet (US14). */
export function useJoinWaitlist(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/v1/events/{id}/waitlist', {
          params: { path: { id: eventId } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myWaitlistKey });
    },
  });
}

/** Quitte une place en liste d'attente (US14). */
export function useLeaveWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { response, error } = await api.DELETE('/api/v1/waitlist/{id}', {
        params: { path: { id: entryId } },
      });
      if (!response.ok) throw new ApiError(response.status, error as ApiErrorBody | undefined);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myWaitlistKey }),
  });
}

/**
 * Annule l'inscription `registrationId` (US06). La place est libérée côté API :
 * on recharge la liste des inscriptions et tous les événements (jauges des listes et des détails).
 * US14 : une promotion éventuelle met aussi à jour listes d'attente et inscriptions.
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
      void queryClient.invalidateQueries({ queryKey: myWaitlistKey });
    },
    // Succès ou refus (403, 404, 409), la liste doit refléter l'état réel.
    onSettled: () => queryClient.invalidateQueries({ queryKey: myRegistrationsKey }),
  });
}
