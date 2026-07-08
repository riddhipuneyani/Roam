import { useNavigate } from 'react-router-dom';
import { Button, Card, CardDescription, CardTitle, FadeInUp } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-2xl">
        <FadeInUp>
          <p className="font-body text-caption uppercase tracking-[0.12em] text-text-muted">
            Dashboard
          </p>
          <h1 className="mt-2 font-display text-display-md">
            Welcome back, {user?.name ?? 'traveler'}
          </h1>
          <p className="mt-3 font-body text-body text-text-muted">
            Your travel journal starts here.
          </p>
        </FadeInUp>

        <FadeInUp delay={0.1} className="mt-10">
          <Card padding="lg">
            <CardTitle>Your journeys</CardTitle>
            <CardDescription>
              Your journeys will appear here once you start planning. For now, this is a quiet
              space waiting for your first trip.
            </CardDescription>
            <div className="mt-6">
              <Button onClick={() => navigate('/plan')}>Plan a new trip</Button>
            </div>
          </Card>
        </FadeInUp>

        <FadeInUp delay={0.15} className="mt-8">
          <Button variant="ghost" onClick={handleLogout}>
            Log out
          </Button>
        </FadeInUp>
      </div>
    </main>
  );
}
