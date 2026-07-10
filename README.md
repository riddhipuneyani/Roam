# Roam

A calm, editorial travel planning platform. Answer a handful of quiet questions — where (or "surprise me"), how long, what pace, who's coming, how you like to eat — and Roam drafts a complete day-by-day itinerary: real places, honest cost estimates, and the **why** behind every single recommendation.

## Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL — must be running before `npm run db:up`)
- A Gemini API key (optional in dev — see below)

## Quick start

```bash
# Install dependencies (root, client, and server)
npm install

# Start PostgreSQL
npm run db:up

# Copy env files and adjust if needed
cp server/.env.example server/.env

# Run database migrations
npm run db:migrate

# Start client + server
npm run dev
```

- **Client:** http://localhost:5173
- **Server:** http://localhost:3001
- **Postgres:** localhost:5432 (user/password/db: `roam`)

## Itinerary generation

Generation runs through a chain of OpenAI-compatible providers, tried in order until
one answers. The default chain is:

1. Gemini `gemini-2.5-flash` (`GEMINI_API_KEY`)
2. Gemini `gemini-2.5-flash-lite` (same key, separate quota bucket)
3. Groq `llama-3.3-70b-versatile` (`GROQ_API_KEY`, via `api.groq.com/openai/v1`)

A quota/rate-limit error, timeout, or outage falls through to the next entry; entries
whose provider has no key are skipped, and the server logs which provider served each
request. Only when the whole chain fails does the user see a "we've hit today's limit"
message. Customize the order with `GENERATION_CHAIN` (see `server/.env.example`).
All keys are used **server-side only** and never reach the client.

**No key?** In dev the server falls back to a built-in sample itinerary (a realistic
Lisbon plan; other destinations are labeled "(sample data)") so the entire product
flow can be exercised. Every fallback use is logged loudly on the server.

The model must return a strict JSON schema; responses are validated server-side and
retried once with the exact validation errors before the user sees a friendly failure
state (the draft trip is kept so generation can be retried from the dashboard).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run client and server together |
| `npm run dev:client` | Vite dev server only |
| `npm run dev:server` | Express dev server only |
| `npm run build` | Build client and server |
| `npm run db:up` | Start Postgres via Docker Compose |
| `npm run db:down` | Stop Postgres container |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate deploy`) |

## Project structure

```
/client                      — React + Vite + TypeScript + Tailwind CSS + Framer Motion
  src/components/ui          — design system (Button, Card, Input, Badge, Spinner, FadeInUp)
  src/features/onboarding    — the /plan question flow (cards, not forms)
  src/pages                  — Landing, Login, Signup, Dashboard, Plan, Itinerary
  src/lib                    — api client, types, curated imagery, draft persistence
/server                      — Express + TypeScript + Prisma + PostgreSQL
  src/routes                 — auth, trips (CRUD + regenerate), generate
  src/lib                    — OpenAI client, prompts, itinerary schema validation, sample data
```

## Product map

- `/` — editorial landing (split hero, photography, how-it-works)
- `/plan` — one-question-per-screen flow: destination or "surprise me" → vibe → duration →
  budget tier → companions → food → interests → review. Answers persist to localStorage so
  an interrupted session can be resumed from the dashboard.
- Surprise me → a discovery screen proposes 4 destinations with per-traveler rationale.
- `/itinerary/:tripId` — magazine-style spread: hero, sticky day-chapter tabs, morning /
  afternoon / evening cards with "why" reasoning + costs, restaurants, per-day budget bars,
  packing list and tips. Each activity/restaurant card has a subtle swap icon that
  regenerates just that slot.
- `/dashboard` — trip library (photo tiles, open / duplicate / delete, draft resume).

## Auth

- Signup/login stores a JWT in an httpOnly `SameSite=Lax` cookie (not localStorage).
- Passwords hashed with bcrypt (cost 12).
- Protected routes on the frontend redirect to `/login` when unauthenticated.
- All `/api/trips` and `/api/generate` routes require the auth cookie.
