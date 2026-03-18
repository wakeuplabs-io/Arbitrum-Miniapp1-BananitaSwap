// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Centralized app storage for router, fee, provider registry.
/// Collision-safe: single namespace slot.
library LibAppStorage {
	bytes32 constant APP_STORAGE_POSITION = keccak256('diamond.router.app.storage');

	struct AppStorage {
		address owner;
		address usdc;
		address feeRecipient;
		uint256 feeBps;
		mapping(bytes32 => address) providerRegistry;
		// Camelot facet config (used by CamelotFacet)
		address camelotRouter;
		// Uniswap V3 facet config (used by UniswapV3Facet)
		address uniswapV3Router;
		uint24 uniswapV3PoolFee; // e.g. 3000 = 0.3%, 500 = 0.05%
	}

	function getAppStorage() internal pure returns (AppStorage storage s) {
		bytes32 position = APP_STORAGE_POSITION;
		assembly {
			s.slot := position
		}
	}
}
