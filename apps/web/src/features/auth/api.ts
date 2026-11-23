import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, unwrap } from '../../api/client';
import type { SignInInput, SignUpInput, User } from '../../api/types';

export const meQueryKey = ['auth', 'me'] as const;

/**
 * Utilisateur connecté, ou `null` si personne ne l'est.
 * Un 401 de `/auth/me` signifie « pas de session » : ce n'est pas une erreur.
 */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async ({ signal }): Promise<User | null> => {
      const result = await api.GET('/api/v1/auth/me', { signal });
      if (result.response.status === 401) return null;
      return unwrap(result);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Crée un compte (n'ouvre pas de session). */
export function useSignUp() {
  return useMutation({
    mutationFn: async (input: SignUpInput) =>
      unwrap(await api.POST('/api/v1/auth/sign-up', { body: input })),
  });
}

/** Ouvre une session : l'API pose le cookie, et la réponse alimente directement `useMe`. */
export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignInInput) =>
      unwrap(await api.POST('/api/v1/auth/sign-in', { body: input })),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

/** Ferme la session côté serveur, puis oublie l'utilisateur côté client. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { response } = await api.POST('/api/v1/auth/sign-out');
      // 204 sans corps : `unwrap` n'est pas adapté.
      if (!response.ok) throw new ApiError(response.status);
    },
    onSuccess: () => queryClient.setQueryData(meQueryKey, null),
  });
}
