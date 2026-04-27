# Arbitrum Mini App

Token swap mini-app for Arbitrum, integrated with Lemon. The app lists popular Arbitrum tokens and routes swaps through Camelot and Uniswap to offer trading outside the exchange UI.

## Project structure

- `packages/ui`: Lemon mini-app frontend (Vite + React + TanStack Router).
- `packages/api`: Backend API (Hono + Drizzle + Neon) for auth and data APIs.
- `packages/sol-contracts`: Diamond router contracts and deployment scripts.
- `sst.config.ts`: Infrastructure and environment wiring for staging/production.

## Prerequisites

- Node.js 20+
- npm 10+
- A PostgreSQL database (Neon recommended)
- RPC URLs for Arbitrum Sepolia and Arbitrum One
- Lemon mini-app environment for end-to-end validation

## Local development

1. Install dependencies:

```bash
npm install
```

2. Configure env files:
- API env at `packages/api/.env.local` (see `packages/api/env.example`).
- UI env at `packages/ui/.env` from `packages/ui/.env.example`.
- Optional root `.env` for SST deploy values.

3. Run app + API locally:

```bash
npm run dev:all
```

4. Default local URLs:
- UI: `http://localhost:5173`
- API: `http://localhost:3000`

## Deployed environments

There is no canonical public URL in this repository: **staging and production hosts depend on your AWS/SST and DNS setup**. After you deploy, document your own URLs in team docs or in a fork (see [`docs/urls-and-environments.md`](docs/urls-and-environments.md)).

## Environment variables

Complete variable reference: [`docs/environment-variables.md`](docs/environment-variables.md)

Key groups:
- **Infrastructure/SST**: `DOMAIN_URL`, `DATABASE_URL`, `RPC_URL_MAINNET`, `RPC_URL_SEPOLIA`, `JWT_SECRET`, `PINATA_JWT`, router addresses.
- **API runtime**: database, RPC, JWT, pinning token, The Graph key.
- **UI runtime**: API URL, RPC URLs, router addresses, testnet flag.
- **Contracts scripts**: deployer key, USDC/router addresses, Arbiscan key.

## Contract deployment

Full runbook: [`docs/contract-deployment.md`](docs/contract-deployment.md)

Includes:
- Arbitrum Sepolia deployment flow.
- Arbitrum One deployment flow.
- Provider registration and verification.
- Post-deploy sync checklist for UI/API env values.

## Lemon integration

Integration details: [`docs/lemon-integration.md`](docs/lemon-integration.md)

The frontend authenticates with Lemon SDK, verifies signature via backend, then uses Lemon contract calls for deposit/withdraw and swap flows.

## URLs and stages

Deployment URL topology, CORS behavior, and development/production differences are documented in:

- [`docs/urls-and-environments.md`](docs/urls-and-environments.md)

## Security notes before going public

- No private keys or real credentials should ever be committed.
- Keep `.env*` files local and use CI/secret managers for deploy stages.
- Rotate credentials immediately if any sensitive value was exposed.
- Run a secret scan on the full git history (for example [gitleaks](https://github.com/gitleaks/gitleaks): `gitleaks detect --source .`) before making the repository public. The scan may flag an old commit that once contained a demo third-party API key; treat that as **rotate the key in the provider**, not only delete the file on `main`.

## Scripts

- `npm run dev:api`: run backend locally.
- `npm run dev:ui`: run frontend locally.
- `npm run dev:all`: run both services.
- `npm run build:ci`: build API and UI.
- `npm run deploy:app:staging`: deploy with SST (staging).
- `npm run deploy:app:production`: deploy with SST (production).

## License

MIT. See [`LICENSE`](LICENSE).