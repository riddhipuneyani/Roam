import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, FadeInUp, Input, Spinner } from '../components/ui';
import { TravelImage } from '../components/TravelImage';
import { SCENES } from '../lib/images';
import { ApiRequestError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export function Signup() {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
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
      await signup(name, email, password);
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
    <main className="grid min-h-screen bg-background lg:grid-cols-12">
      {/* Photo panel on the LEFT — mirrored from the login page */}
      <div className="relative hidden lg:col-span-7 lg:block">
        <TravelImage
          src={SCENES.signupPanel}
          alt="A traveler standing above a sea of clouds"
          fallbackSeed="signup"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/10 to-transparent" />
        <figure className="absolute bottom-12 left-12 right-12 max-w-lg">
          <blockquote className="font-display text-3xl italic leading-snug text-background">
            The first draft of a trip should take two minutes, not two weekends.
          </blockquote>
          <figcaption className="kicker mt-4 !text-background/70">
            The whole idea, in one line
          </figcaption>
        </figure>
      </div>

      {/* Form column */}
      <div className="flex flex-col px-6 py-6 md:px-12 lg:col-span-5 lg:px-16">
        <div className="flex justify-end lg:justify-start">
          <Link to="/" className="font-display text-2xl italic tracking-tight">
            Roam
          </Link>
        </div>

        <FadeInUp className="my-auto max-w-md py-16">
          <p className="kicker-accent">First things first</p>
          <h1 className="mt-4 font-display text-display-md [text-wrap:balance]">
            Start keeping your trips somewhere.
          </h1>
          <p className="mt-3 font-body text-body text-text-muted">
            An account keeps every draft and itinerary on your shelf.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
            {error && (
              <div
                role="alert"
                className="border-l-2 border-accent bg-accent-muted/15 px-4 py-3 font-body text-body-sm text-accent-hover"
              >
                {error}
              </div>
            )}

            <Input
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Your name"
            />

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
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />

            <Button type="submit" disabled={isSubmitting} className="mt-1 w-full py-3">
              {isSubmitting ? (
                <>
                  <Spinner size="sm" label="Creating account" className="[&>span]:bg-background/90" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <p className="mt-8 font-body text-body-sm text-text-muted">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Log in
            </Link>
          </p>
        </FadeInUp>
      </div>
    </main>
  );
}
