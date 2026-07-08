import { useNavigate } from 'react-router-dom';
import { Button, FadeInUp } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  function handlePlanTrip() {
    navigate(isAuthenticated ? '/dashboard' : '/login');
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center md:px-10">
        <FadeInUp className="mx-auto max-w-3xl">
          <p className="font-body text-caption uppercase tracking-[0.14em] text-text-muted">
            Roam
          </p>
          <h1 className="mt-4 font-display text-display-lg md:text-display-xl">
            Your next journey, thoughtfully planned
          </h1>
          <p className="mx-auto mt-6 max-w-xl font-body text-body-lg text-text-muted">
            Sketch trips with intention — unhurried, personal, and entirely yours.
          </p>
          <div className="mt-10">
            <Button onClick={handlePlanTrip} className="min-w-[180px] px-8 py-3">
              Plan your trip
            </Button>
          </div>
        </FadeInUp>
      </section>
    </main>
  );
}
