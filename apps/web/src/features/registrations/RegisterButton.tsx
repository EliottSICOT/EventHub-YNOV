import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { useMe } from '../auth/api';
import { useRegister } from './api';

interface RegisterButtonProps {
  event: Pick<EventDetail, 'id' | 'title' | 'startsAt' | 'isFull'>;
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

/**
 * Action « S'inscrire » du détail d'un événement (US05), avec ses états :
 * visiteur (renvoyé vers la connexion), prêt, en cours, inscrit, complet, terminé, erreur.
 */
export function RegisterButton({ event, now: nowProp }: RegisterButtonProps) {
  const [now] = useState(() => nowProp ?? Date.now());
  const { data: user, isPending: sessionPending } = useMe();
  const location = useLocation();
  const register = useRegister(event.id);

  if (register.isSuccess) {
    return (
      <div className="register">
        <button type="button" className="button" disabled>
          Inscrit ✓
        </button>
        <p className="register__confirmation" role="status">
          Inscription confirmée : vous participez à « {event.title} ». Vous allez recevoir un e-mail
          de confirmation{user && <> à l'adresse {user.email}</>}.{' '}
          <Link to="/mes-inscriptions">Voir mes inscriptions</Link>
        </p>
      </div>
    );
  }

  if (new Date(event.startsAt).getTime() <= now) {
    return (
      <button type="button" className="button" disabled>
        Événement terminé
      </button>
    );
  }

  if (event.isFull) {
    return (
      <button type="button" className="button" disabled>
        Complet
      </button>
    );
  }

  if (!sessionPending && !user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <Link to={`/connexion?redirect=${redirect}`} className="button">
        S'inscrire
      </Link>
    );
  }

  return (
    <div className="register">
      <button
        type="button"
        className="button"
        disabled={sessionPending || register.isPending}
        onClick={() => register.mutate()}
      >
        {register.isPending ? 'Inscription…' : "S'inscrire"}
      </button>
      {register.isError && (
        <p className="register__error" role="alert">
          {errorMessage(register.error)}
        </p>
      )}
    </div>
  );
}
