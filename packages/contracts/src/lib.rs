#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

/// Shared interfaces: IERC20 + IDexAdapter.
/// Always compiled so all contracts can reference them.
pub mod interfaces;

/// DexRouter: fee-taking swap router with a dynamic adapter registry.
/// Compiled only when `--features contract-router` (the default).
#[cfg(feature = "contract-router")]
pub mod router;

/// DEX adapters. Each adapter is a separate deployable contract compiled
/// by passing `--no-default-features --features contract-<name>`.
#[cfg(any(feature = "contract-camelot", feature = "contract-uniswap-v3"))]
pub mod adapters;
