# API Package

Backend API built with Hono, Drizzle ORM, and Neon PostgreSQL.

## Setup

1. Install dependencies from the repo root:
```bash
npm install
```

2. Configure environment variables:

```bash
# Copy the example and fill in your values
cp env.example .env.local
```

The only required variable to start is `DATABASE_URL`. Get a free connection string from [Neon](https://neon.tech) and set it in `.env.local`. See `env.example` for all available variables.

3. Generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

## Development

```bash
npm run dev
```

Server starts on `http://localhost:3000`.

## Database

Uses Drizzle ORM with Neon PostgreSQL.

- `npm run db:generate` — generate migrations from schema
- `npm run db:migrate` — run pending migrations
- `npm run db:push` — push schema changes directly (dev only)
- `npm run db:studio` — open Drizzle Studio

## Endpoints

- `GET /health` — health check
- `POST /auth/...` — authentication (SIWE-based)
- `GET /tokens/...` — token list and metadata
- `GET /users/...` — user data

## Utility scripts

- `npm run verify-siwe` — verify a SIWE signature from the CLI
- `npm run fetch-usdc-tokens` — fetch and cache USDC-paired tokens from The Graph
