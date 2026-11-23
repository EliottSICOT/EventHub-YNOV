import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '../../api/types';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { useMe } from './api';

interface RequireAuthProps {
  /** Rôle exigé, par exemple `ORGANIZER` pour les écrans organisateur (US08). */
  role?: Role;
  /** Contenu protégé ; sans enfant, rend les routes imbriquées (`<Outlet />`). */
  children?: ReactNode;
}

/**
 * Garde de route : un visiteur non connecté est envoyé vers `/connexion?redirect=…`,
 * puis ramené ici une fois connecté. Avec `role`, un utilisateur sans ce rôle voit un refus.
 *
 * Usage dans `routes.tsx` :
 * `{ element: <RequireAuth role="ORGANIZER" />, children: [{ path: 'organisateur', … }] }`
 */
export function RequireAuth({ role, children }: RequireAuthProps) {
  const { data: user, isPending, isError, refetch } = useMe();
  const location = useLocation();

  if (isPending) return <Spinner label="Vérification de la session…" />;

  if (isError) {
    return (
      <StatusMessage variant="error" title="Impossible de vérifier votre session">
        <button type="button" className="button" onClick={() => void refetch()}>
          Réessayer
        </button>
      </StatusMessage>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/connexion?redirect=${redirect}`} replace />;
  }

  if (role && user.role !== role) {
    return (
      <StatusMessage variant="error" title="Accès réservé">
        <p>
          Cette page est réservée aux {role === 'ORGANIZER' ? 'organisateurs' : 'participants'}.
        </p>
        <Link to="/events">Voir les événements</Link>
      </StatusMessage>
    );
  }

  return children ?? <Outlet />;
}

/** Variante pour les écrans organisateur (US08). */
export function RequireOrganizer({ children }: { children?: ReactNode }) {
  return <RequireAuth role="ORGANIZER">{children}</RequireAuth>;
}
