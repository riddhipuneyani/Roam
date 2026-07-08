import { useNavigate } from 'react-router-dom';
import { Button, Card, CardDescription, CardTitle, FadeInUp } from '../components/ui';

export function Plan() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <FadeInUp className="w-full max-w-md">
        <Card padding="lg" className="text-center">
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Trip planning is on its way. You&apos;ll be able to sketch destinations, vibes, and
            itineraries here in a future update.
          </CardDescription>
          <div className="mt-6">
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      </FadeInUp>
    </main>
  );
}
