import { Link, Outlet } from 'react-router';
import { SessionMenu } from '../features/auth/SessionMenu';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Lien d'évitement (WCAG 2.4.1) : premier élément atteint au clavier. */}
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-40 border-b border-separator bg-surface/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <Link
            to="/events"
            className="flex items-center gap-2 rounded-lg text-xl font-extrabold tracking-tight text-foreground no-underline"
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-black text-accent-foreground"
            >
              E
            </span>
            EventHub
          </Link>
          <SessionMenu />
        </div>
      </header>
      <main
        id="contenu"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6"
      >
        <Outlet />
      </main>
      <footer className="border-t border-separator py-6 text-center text-sm text-muted">
        EventHub · Projet YNOV
      </footer>
    </div>
  );
}
