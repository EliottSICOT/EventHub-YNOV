import { Button } from '@heroui/react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { linkButton, textLink } from '../../components/ui';
import { useMe } from '../auth/api';
import {
  useJoinWaitlist,
  useLeaveWaitlist,
  useMyRegistrations,
  useMyWaitlist,
  useRegister,
} from './api';

interface RegisterButtonProps {
  event: Pick<EventDetail, 'id' | 'title' | 'startsAt' | 'isFull' | 'isCancelled'>;
  /** Instant de référence pour savoir si l'événement est passé (injectable pour les tests). */
  now?: number;
}

/** Message affiché à l'utilisateur quand l'inscription échoue. */
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous pour vous inscrire.';
    if (error.status === 404) return "Cet événement n'existe plus.";
    if (error.status === 409) return error.message;
  }
  return "L'inscription a échoué. Réessayez dans un instant.";
}

function waitlistErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Votre session a expiré. Reconnectez-vous pour rejoindre la liste d’attente.';
    if (error.status === 404) return "Cet événement n'existe plus.";
    if (error.status === 409) return error.message;
  }
  return 'Impossible de rejoindre la liste d’attente. Réessayez dans un instant.';
}

/**
 * Action « S'inscrire » du détail d'un événement (US05), avec ses états :
 * visiteur, prêt, en cours, inscrit, annulé, complet (+ liste d'attente US14), terminé, erreur.
 */
export function RegisterButton({ event, now: nowProp }: RegisterButtonProps) {
  const [now] = useState(() => nowProp ?? Date.now());
  const { data: user, isPending: sessionPending } = useMe();
  const location = useLocation();
  const register = useRegister(event.id);
  const joinWaitlist = useJoinWaitlist(event.id);
  const leaveWaitlist = useLeaveWaitlist();
  const myRegistrations = useMyRegistrations();
  const waitlist = useMyWaitlist();
  const myEntry = waitlist.data?.find((entry) => entry.event.id === event.id);
  const alreadyRegistered =
    register.isSuccess || myRegistrations.data?.some((item) => item.event.id === event.id);

  if (event.isCancelled) {
    return (
      <Button fullWidth size="lg" isDisabled>
        Événement annulé
      </Button>
    );
  }

  if (alreadyRegistered) {
    return (
      <div className="flex flex-col gap-3">
        <Button fullWidth size="lg" isDisabled>
          Inscrit ✓
        </Button>
        {register.isSuccess && (
          <p className="text-sm text-success-soft-foreground" role="status">
            Inscription confirmée : vous participez à « {event.title} ». Vous allez recevoir un
            e-mail de confirmation{user && <> à l'adresse {user.email}</>}.{' '}
            <Link to="/mes-inscriptions" className={textLink}>
              Voir mes inscriptions
            </Link>
          </p>
        )}
      </div>
    );
  }

  if (new Date(event.startsAt).getTime() <= now) {
    return (
      <Button fullWidth size="lg" isDisabled>
        Événement terminé
      </Button>
    );
  }

  if (event.isFull) {
    if (!sessionPending && !user) {
      const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
      return (
        <Link
          to={`/connexion?redirect=${redirect}`}
          className={linkButton('primary', 'lg') + ' w-full'}
        >
          Rejoindre la liste d'attente
        </Link>
      );
    }

    const onWaitlist = myEntry ?? (joinWaitlist.isSuccess ? joinWaitlist.data : null);
    if (onWaitlist) {
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-success-soft-foreground" role="status">
            Vous êtes en liste d'attente (position {onWaitlist.position}).
          </p>
          <Button
            fullWidth
            variant="outline"
            isDisabled={leaveWaitlist.isPending}
            onPress={() =>
              leaveWaitlist.mutate(onWaitlist.id, { onSuccess: () => joinWaitlist.reset() })
            }
          >
            {leaveWaitlist.isPending ? 'Retrait…' : "Quitter la liste d'attente"}
          </Button>
          {leaveWaitlist.isError && (
            <p className="text-sm font-medium text-danger-soft-foreground" role="alert">
              Impossible de quitter la liste d'attente. Réessayez.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <Button
          fullWidth
          size="lg"
          isDisabled={sessionPending || joinWaitlist.isPending || waitlist.isPending}
          onPress={() => joinWaitlist.mutate()}
        >
          {joinWaitlist.isPending ? 'Inscription…' : "Rejoindre la liste d'attente"}
        </Button>
        {joinWaitlist.isError && (
          <p className="text-sm font-medium text-danger-soft-foreground" role="alert">
            {waitlistErrorMessage(joinWaitlist.error)}
          </p>
        )}
      </div>
    );
  }

  if (!sessionPending && !user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <Link
        to={`/connexion?redirect=${redirect}`}
        className={linkButton('primary', 'lg') + ' w-full'}
      >
        S'inscrire
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        fullWidth
        size="lg"
        isDisabled={sessionPending || register.isPending}
        onPress={() => register.mutate()}
      >
        {register.isPending ? 'Inscription…' : "S'inscrire"}
      </Button>
      {register.isError && (
        <p className="text-sm font-medium text-danger-soft-foreground" role="alert">
          {errorMessage(register.error)}
        </p>
      )}
    </div>
  );
}
