# Lemon integration

## Overview

The mini-app runs inside Lemon WebView and uses `@lemoncash/mini-app-sdk` for:

- Wallet authentication and claims.
- Signing/auth flow.
- Deposit and withdraw actions.
- Smart contract interactions for swaps.

## Flow

1. Frontend checks if it is running in Lemon WebView.
2. Frontend requests nonce from backend.
3. Lemon SDK authenticates and returns wallet/signature/message.
4. Backend verifies signature and returns JWT.
5. Frontend stores wallet + JWT for protected API calls.
6. Deposit/withdraw/swap calls run through Lemon SDK methods.

## Requirements

- App must be opened from Lemon for transaction features.
- Backend auth endpoints must be reachable from mini-app URL.
- Network config must match deployed contract addresses and chain.

## Troubleshooting

- If authentication fails, verify backend nonce and signature endpoints.
- If transactions fail, verify chain ID and router address env values.
- If not in Lemon WebView, app should gracefully block Lemon-only actions.
