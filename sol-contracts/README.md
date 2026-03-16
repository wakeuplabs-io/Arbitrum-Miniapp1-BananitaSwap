# Diamond DEX Router (Solidity / Hardhat)

EIP-2535 Diamond proxy implementation of the DEX router: single entrypoint, provider facets (Camelot V3, Uniswap V3), configurable fee.

## Structure

- **Diamond** – Proxy with fallback that delegatecalls to facets by selector.
- **diamond/** – DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet.
- **facets/** – RouterFacet (`buy` / `sell`), CamelotFacet (executeBuy / executeSell).
- **libraries/** – LibDiamond (selector → facet), LibAppStorage (owner, usdc, fee, provider registry).
- **interfaces/** – IDiamondCut, IDiamondLoupe, IERC173, ISwapProvider, ICamelotV3Router, IERC20.
- **DiamondInit** – One-time init (owner, usdc, feeRecipient, feeBps, camelotRouter).

## Testing

### 1. Unit / integration tests (no chain)

Runs the Diamond + Router + Camelot flow against mocks (MockERC20, MockCamelotRouter) on Hardhat’s in-memory network:

```bash
npm run compile
npm test
```

No `.env` or real RPC needed.

### 2. Live test on Arbitrum Sepolia

End-to-end test against real contracts and Camelot on testnet.

1. **Get testnet funds**
   - **ETH (gas):** [Arbitrum Sepolia faucet](https://faucet.quicknode.com/arbitrum/sepolia) or [Arbitrum faucet](https://faucet.arbitrum.io/)
   - **USDC (optional for buy):** Use a [USDC faucet](https://www.circle.com/faucets) for Sepolia if available, or bridge/mint on testnet.

2. **Configure `.env`** (in `sol-contracts/`):
   ```bash
   PRIVATE_KEY=0x...          # deployer/owner (and swapper) wallet
   USDC_ADDRESS=0x...          # Arbitrum Sepolia USDC
   FEE_RECIPIENT=0x...
   CAMELOT_ROUTER=0x...       # Camelot V3 router on Arbitrum Sepolia
   ```

3. **Deploy** (if not already):
   ```bash
   npm run deploy:arbitrum-sepolia
   ```
   Copy the printed addresses into `scripts/constants.js` (DIAMOND, facets, etc.).

4. **One-time setup (as owner)**
   ```bash
   npm run set-provider:arbitrum-sepolia   # register Camelot provider
   ```

5. **Run swap**
   - Edit `scripts/swap.js` `config` (or use env) for `swapMode`, `amountHuman`, `minOutHuman`.
   - **Buy (USDC → WETH):** ensure you have USDC; run:
     ```bash
     npm run swap:arbitrum-sepolia
     ```
   - **Sell (WETH → USDC):** set `swapMode: 'sell'` and have WETH; run the same command.
   - The script logs balances before and after.

If you hit “provider not found”, run `set-provider:arbitrum-sepolia`.

### 3. Deploy and swap on Arbitrum One (mainnet)

1. **Configure `.env`** for mainnet:
   ```bash
   PRIVATE_KEY=0x...
   USDC_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831   # native USDC on Arbitrum One
   CAMELOT_ROUTER=0x1F721E2E82F6676FCE4eA07A5958cF098D339e18  # Camelot V3 router
   FEE_RECIPIENT=0x...   # optional, defaults to deployer
   ```

2. **Deploy:**
   ```bash
   npm run deploy:arbitrum-one
   ```
   Copy the printed `DIAMOND_ARB_ONE`, `CAMELOT_FACET_ARB_ONE`, `UNISWAP_V3_FACET_ARB_ONE` into `.env`.

3. **Register provider(s)** (owner, once):
   ```bash
   npm run set-provider:arbitrum-one
   # optional: npm run set-uniswap-provider:arbitrum-one  # sets Uniswap router + fee for provider 'uniswap'
   ```

4. **Swap via Diamond** (e.g. 0.1 USDC → WETH with Camelot):
   ```bash
   npm run swap:arbitrum-one
   ```
   Ensure `scripts/swap.js` has `provider: 'camelot'` (or `'uniswap'`) and `amountHuman: '0.1'` as needed.

## Commands

```bash
npm run compile
npm test
npm run deploy:local          # requires local node; set USDC_ADDRESS, CAMELOT_ROUTER, FEE_RECIPIENT if needed
npm run deploy:arbitrum-sepolia
npm run deploy:arbitrum-one        # mainnet; set USDC_ADDRESS, CAMELOT_ROUTER in .env
npm run set-provider:arbitrum-sepolia
npm run set-provider:arbitrum-one
npm run swap:arbitrum-sepolia
npm run swap:arbitrum-one          # swap via Diamond on mainnet (set DIAMOND_ARB_ONE in .env)
npm run verify:arbitrum-sepolia     # verify all contracts on Arbiscan (set ARBISCAN_API_KEY in .env)
```

### Swap script

Set in `.env` (or export) then run `npm run swap` or `npm run swap:arbitrum-sepolia`:

Before swapping, the Diamond owner must **register the provider** once: `npm run set-provider:arbitrum-sepolia`.

| Variable         | Required | Description                                      |
|-----------------|----------|--------------------------------------------------|
| `USDC_ADDRESS`  | For buy  | USDC contract (needed for approval in buy)       |
| `SWAP_MODE`     | No       | `buy` (default) or `sell`                        |
| `TOKEN_ADDRESS` | Yes      | Token to buy (receive) or sell (send); swap script uses WETH from constants by default |
| `AMOUNT`        | Yes      | Human amount (e.g. `100` USDC for buy, `1` for sell) |
| `MIN_OUT`       | Yes      | Minimum output (slippage), same decimals as output |
| `USDC_DECIMALS` | No       | Default `6`                                     |
| `TOKEN_DECIMALS`| No       | Default `18`                                    |

Example buy (USDC → token):  
`SWAP_MODE=buy TOKEN_ADDRESS=0x... AMOUNT=100 MIN_OUT=0.5 USDC_ADDRESS=0x...`

Example sell (token → USDC):  
`SWAP_MODE=sell TOKEN_ADDRESS=0x... AMOUNT=1 MIN_OUT=50`

## Flow

- **buy(token, usdcAmount, minTokenOut, providerId, deadline)** – Router pulls USDC, deducts fee, delegatecalls provider `executeBuy`, sends token to user.
- **sell(token, tokenAmount, minUsdcOut, providerId, deadline)** – Router pulls token, deducts fee, delegatecalls provider `executeSell`, sends USDC to user.

Provider registry: `providerId` (e.g. `keccak256("camelot")`, `keccak256("uniswap")`) → facet address. Owner sets providers via RouterFacet admin functions.

### Verification (Arbiscan)

1. Get an API key from [Arbiscan](https://sepolia.arbiscan.io/myapikey) (same key works for Arbitrum Sepolia).
2. Add to `.env`: `ARBISCAN_API_KEY=YourKey`
3. Run: `npm run verify:arbitrum-sepolia`

This verifies Diamond, DiamondInit, and all facets (DiamondCut, DiamondLoupe, Ownership, Router, Camelot). Constructor args for the Diamond are built from `scripts/constants.js` and from `.env` (USDC_ADDRESS, FEE_RECIPIENT, CAMELOT_ROUTER) so they must match the values used at deploy time.
