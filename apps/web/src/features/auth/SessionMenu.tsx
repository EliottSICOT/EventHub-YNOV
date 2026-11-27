import { Button } from '@heroui/react';
import { NavLink, useLocation, useNavigate, type NavLinkProps } from 'react-router';
import { linkButton } from '../../components/ui';
import { useMe, useSignOut } from './api';

const AUTH_PAGES = ['/connexion', '/inscription'];

/** Lien de navigation : la page courante est signalée (aria-current) et soulignée. */
function NavItem(props: NavLinkProps) {
  return (
    <NavLink
      {...props}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors hover:bg-default ${
          isActive ? 'text-accent-soft-foreground underline underline-offset-8' : 'text-foreground'
        }`
      }
    />
  );
}

/** Zone de session du layout : « Bonjour {prénom} » et Déconnexion, ou Connexion / Inscription. */
export function SessionMenu() {
  const { data: user, isPending } = useMe();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const location = useLocation();

  // Tant que /auth/me n'a pas répondu, on n'affiche rien : ni liens ni prénom qui se remplaceraient.
  if (isPending) return <div className="min-h-10" aria-hidden="true" />;

  if (user) {
    return (
      <nav aria-label="Compte" className="flex flex-wrap items-center gap-1 sm:gap-2">
        {user.role === 'ORGANIZER' && <NavItem to="/organisateur">Mes événements</NavItem>}
        <NavItem to="/mes-inscriptions">Mes inscriptions</NavItem>
        <span className="px-2 text-sm text-muted">Bonjour {user.firstName}</span>
        <Button
          variant="tertiary"
          size="sm"
          isDisabled={signOut.isPending}
          onPress={() =>
            signOut.mutate(undefined, { onSuccess: () => navigate('/events', { replace: true }) })
          }
        >
          Déconnexion
        </Button>
        {signOut.isError && (
          <span className="text-sm font-medium text-danger-soft-foreground" role="alert">
            Échec de la déconnexion, réessayez.
          </span>
        )}
      </nav>
    );
  }

  // Après connexion, on revient sur la page courante (sauf depuis les écrans d'authentification).
  const here = `${location.pathname}${location.search}`;
  const query = AUTH_PAGES.includes(location.pathname)
    ? location.search
    : `?redirect=${encodeURIComponent(here)}`;

  return (
    <nav aria-label="Compte" className="flex items-center gap-2">
      <NavItem to={`/connexion${query}`}>Connexion</NavItem>
      <NavLink to={`/inscription${query}`} className={linkButton('primary', 'sm')}>
        Inscription
      </NavLink>
    </nav>
  );
}
