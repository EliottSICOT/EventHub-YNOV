import { Link, Outlet } from 'react-router';
import { SessionMenu } from '../features/auth/SessionMenu';

export function Layout() {
  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/events" className="brand">
            EventHub
          </Link>
          <SessionMenu />
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
