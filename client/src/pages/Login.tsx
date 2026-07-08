import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, FadeInUp, Input, Spinner } from '../components/ui';
import { ApiRequestError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <FadeInUp className="w-full max-w-md">
        <Card padding="lg">
          <h1 className="font-display text-display-sm">Welcome back</h1>
          <p className="mt-2 font-body text-body text-text-muted">
            Log in to continue planning your journeys.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-accent/25 bg-accent-muted/15 px-4 py-3 font-body text-body-sm text-accent-hover"
              >
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your password"
            />

            <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
              {isSubmitting ? (
                <>
                  <Spinner size="sm" label="Logging in" className="[&>span]:bg-background/90" />
                  Logging in...
                </>
              ) : (
                'Log in'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center font-body text-body-sm text-text-muted">
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-accent hover:text-accent-hover transition-colors duration-200"
            >
              Sign up
            </Link>
          </p>
        </Card>
      </FadeInUp>
    </main>
  );
}
