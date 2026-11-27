import { Link, Outlet } from 'react-router';
import { SessionMenu } from '../features/auth/SessionMenu';
import { BackgroundGlow, BackgroundMotionToggle, useBackgroundMotion } from './BackgroundGlow';

export function Layout() {
  const motion = useBackgroundMotion();

  return (
    <div className="flex min-h-screen flex-col">
      <BackgroundGlow paused={motion.paused} />
      {/* Lien d'évitement (WCAG 2.4.1) : premier élément atteint au clavier. */}
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-40 border-b border-separator bg-surface backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <Link
            to="/events"
            className="flex items-center gap-2 rounded-lg text-xl font-extrabold tracking-tight text-foreground no-underline"
          >
            <span
              aria-hidden="true"
              className="brand-mark grid size-8 place-items-center rounded-lg text-sm font-black"
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
      <footer className="border-t border-separator bg-surface backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted sm:px-6">
          <span>EventHub · Projet YNOV</span>
          <BackgroundMotionToggle paused={motion.paused} onToggle={motion.toggle} />
        </div>
      </footer>
    </div>
  );
}
