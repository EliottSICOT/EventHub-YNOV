import { Link, useLocation, useNavigate } from 'react-router';
import { useMe, useSignOut } from './api';

const AUTH_PAGES = ['/connexion', '/inscription'];

/** Zone de session du layout : « Bonjour {prénom} » et Déconnexion, ou Connexion / Inscription. */
export function SessionMenu() {
  const { data: user, isPending } = useMe();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const location = useLocation();

  // Tant que /auth/me n'a pas répondu, on n'affiche rien : ni liens ni prénom qui se remplaceraient.
  if (isPending) return <div className="session" aria-hidden="true" />;

  if (user) {
    return (
      <div className="session">
        <Link to="/mes-inscriptions">Mes inscriptions</Link>
        <span className="session__greeting">Bonjour {user.firstName}</span>
        <button
          type="button"
          className="button button--ghost button--small"
          disabled={signOut.isPending}
          onClick={() =>
            signOut.mutate(undefined, { onSuccess: () => navigate('/events', { replace: true }) })
          }
        >
          Déconnexion
        </button>
        {signOut.isError && (
          <span className="session__error" role="alert">
            Échec de la déconnexion, réessayez.
          </span>
        )}
      </div>
    );
  }

  // Après connexion, on revient sur la page courante (sauf depuis les écrans d'authentification).
  const here = `${location.pathname}${location.search}`;
  const query = AUTH_PAGES.includes(location.pathname)
    ? location.search
    : `?redirect=${encodeURIComponent(here)}`;

  return (
    <nav className="session" aria-label="Compte">
      <Link to={`/connexion${query}`}>Connexion</Link>
      <Link to={`/inscription${query}`} className="button button--small">
        Inscription
      </Link>
    </nav>
  );
}
