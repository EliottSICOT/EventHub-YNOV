import { Link, Outlet } from 'react-router';

export function Layout() {
  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/events" className="brand">
            EventHub
          </Link>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
