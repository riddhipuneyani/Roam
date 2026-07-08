# Roam

Travel planning web app — Phase 1 foundation (auth + project structure).

## Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL — must be running before `npm run db:up`)

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
/client   — React + Vite + TypeScript + Tailwind CSS
/server   — Express + TypeScript + Prisma + PostgreSQL
```

## Auth

- Signup/login stores a JWT in an httpOnly cookie (not localStorage).
- Protected routes on the frontend redirect to `/login` when unauthenticated.
- Backend `auth` middleware is available for future protected API routes.
