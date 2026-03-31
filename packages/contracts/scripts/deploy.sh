#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
	# shellcheck disable=SC1090
	source "$ENV_FILE"
fi

trim() {
	# Avoid xargs (can fail in some environments); just trim leading/trailing whitespace.
	# Also strips CR in case file was edited on Windows.
	printf '%s' "${1:-}" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

ARB_RPC="$(trim "${ARB_RPC:-}")"
PRIVATE_KEY="$(trim "${PRIVATE_KEY:-}")"
MAX_FEE_PER_GAS_GWEI="$(trim "${MAX_FEE_PER_GAS_GWEI:-1}")"

if [[ -z "${ARB_RPC:-}" ]]; then
	echo "Missing ARB_RPC. Set it in scripts/.env, e.g. ARB_RPC=https://sepolia-rollup.arbitrum.io/rpc"
	exit 1
fi

if [[ ! "$ARB_RPC" =~ ^https?:// ]]; then
	echo "ARB_RPC must be a full URL (http/https). Current value: $ARB_RPC"
	exit 1
fi

if [[ -z "${PRIVATE_KEY:-}" ]]; then
	echo "Missing PRIVATE_KEY. Set it in scripts/.env (hex string with 0x prefix)."
	exit 1
fi

# Basic validation: must be 32-byte hex with 0x prefix.
# Prevents placeholder values like 0xYOUR_PRIVATE_KEY from reaching stylus deploy.
if [[ "$PRIVATE_KEY" == *"YOUR_PRIVATE_KEY"* ]]; then
	echo "PRIVATE_KEY looks like a placeholder. Update scripts/.env with your real hex key (0x...64 hex chars)."
	exit 1
fi
if [[ ! "$PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
	echo "PRIVATE_KEY must be 0x + 64 hex chars. Current value: $PRIVATE_KEY"
	exit 1
fi

echo "Deploying contracts to: $ARB_RPC"

# EIP-1559: ensure maxFeePerGas >= current baseFee.
# If the network base fee is slightly higher than our default, stylus deploy reverts.
# You can override by setting MAX_FEE_PER_GAS_GWEI in scripts/.env.
MAX_FEE_PER_GAS_GWEI="${MAX_FEE_PER_GAS_GWEI:-1}"

VERIFY_FLAGS=()
# stylus deploy por defecto intenta verificaciones reproducibles dentro de Docker.
# Si tu entorno no tiene acceso al Docker daemon, usa STYLUS_NO_VERIFY=1.
if [[ "${STYLUS_NO_VERIFY:-0}" == "1" ]]; then
	VERIFY_FLAGS+=(--no-verify)
fi

# Router

# Uniswap V3 adapter
cargo stylus deploy \
	--endpoint "$ARB_RPC" \
	--private-key "$PRIVATE_KEY" \
	--features contract-uniswap-v3 \
	--max-fee-per-gas-gwei "$MAX_FEE_PER_GAS_GWEI" \
	"${VERIFY_FLAGS[@]}"