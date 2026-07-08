import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Slim editorial top bar for signed-in screens. */
export function AppNav() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="flex items-baseline justify-between px-6 py-4 md:px-12">
        <Link
          to="/dashboard"
          className="font-display text-2xl italic tracking-tight text-text-primary transition-colors hover:text-accent"
        >
          Roam
        </Link>
        <nav className="flex items-baseline gap-6">
          <Link
            to="/dashboard"
            className="font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
          >
            Your journeys
          </Link>
          <Link
            to="/plan"
            className="font-body text-body-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Plan a trip
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="font-body text-body-sm text-text-muted transition-colors hover:text-text-primary"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
