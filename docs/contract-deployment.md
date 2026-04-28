# Contract deployment runbook

Contracts live in `packages/sol-contracts`.

## 1) Prepare environment

In `packages/sol-contracts/.env`:

```bash
PRIVATE_KEY=0x...
USDC_ADDRESS=0x...
CAMELOT_ROUTER=0x...
FEE_RECIPIENT=0x...
ARBISCAN_API_KEY=...
```

## 2) Deploy to Arbitrum Sepolia

```bash
cd packages/sol-contracts
npm install
npm run deploy:arbitrum-sepolia
npm run set-provider:arbitrum-sepolia
```

Optional verify:

```bash
npm run verify:arbitrum-sepolia
```

## 3) Deploy to Arbitrum One

```bash
cd packages/sol-contracts
npm run deploy:arbitrum-one
npm run set-provider:arbitrum-one
```

Optional Uniswap provider registration:

```bash
npm run set-uniswap-provider:arbitrum-one
```

## 4) Post-deploy sync checklist

After each deployment, update:

- Root/SST variables:
  - `ROUTER_ADDRESS_SEPOLIA`
  - `ROUTER_ADDRESS_MAINNET`
- UI env values:
  - `VITE_ROUTER_ADDRESS_SEPOLIA`
  - `VITE_ROUTER_ADDRESS_MAINNET`

Then redeploy app infra:

```bash
npm run deploy:app:staging
npm run deploy:app:production
```

## 5) Smoke test

- Confirm token list endpoint returns data.
- Confirm buy/sell simulation works.
- Confirm one real small swap in Lemon (manual validation).
