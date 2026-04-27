# Environment variables

This document centralizes required variables for local development and deployments.

## Root/SST variables

Configured in root `.env` or CI secrets/vars:

- `DOMAIN_URL` (required): base domain for UI (`https://<DOMAIN_URL>`) and API (`https://api.<DOMAIN_URL>`).
- `DATABASE_URL` (required): PostgreSQL connection string.
- `RPC_URL_MAINNET` (required): Arbitrum One RPC URL.
- `RPC_URL_SEPOLIA` (required): Arbitrum Sepolia RPC URL.
- `JWT_SECRET` (required): backend JWT signing secret.
- `PINATA_JWT` (required): token for metadata pinning service.
- `IS_TESTNET` (optional): `true` or `false`, used by UI behavior.
- `ROUTER_ADDRESS_SEPOLIA` (required): deployed router address on Sepolia.
- `ROUTER_ADDRESS_MAINNET` (required): deployed router address on mainnet.
- `SUPPORT_USER_ARN` (optional): IAM principal allowed to read CloudWatch logs.

## API variables

Use `packages/api/env.example` as a template, then configure `packages/api/.env.local` for local dev:

- `DATABASE_URL` (required)
- `MAINNET_RPC_URL` (required)
- `SEPOLIA_RPC_URL` (required)
- `JWT_SECRET` (required)
- `PINATA_JWT` (required)
- `IS_TESTNET` (optional)
- `GRAPH_API_KEY` (required for token discovery through The Graph gateway)

## UI variables

Configured in `packages/ui/.env`:

- `VITE_API_URL` (required): API base URL.
- `VITE_RPC_URL_SEPOLIA` (required): Sepolia RPC URL (public in client bundle).
- `VITE_RPC_URL_MAINNET` (optional): mainnet RPC URL (public in client bundle).
- `VITE_ROUTER_ADDRESS_SEPOLIA` (required)
- `VITE_ROUTER_ADDRESS_MAINNET` (required)
- `VITE_IS_TESTNET` (optional): `true`/`false`.

## Contracts variables

Configured in `packages/sol-contracts/.env`:

- `PRIVATE_KEY` (required for deploy/scripting)
- `USDC_ADDRESS` (required)
- `CAMELOT_ROUTER` (required)
- `FEE_RECIPIENT` (optional, defaults to deployer in scripts where applicable)
- `ARBISCAN_API_KEY` (required for verify commands)
- `DIAMOND_ARB_ONE` and other deployed addresses (required by some scripts)

## Security guidance

- Never commit real `.env` files.
- Treat all `VITE_*` values as public.
- Use secret managers/CI protected secrets for staging and production.
