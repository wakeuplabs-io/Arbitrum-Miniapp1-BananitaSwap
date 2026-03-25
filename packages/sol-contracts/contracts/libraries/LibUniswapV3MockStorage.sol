// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Storage for UniswapV3FacetMock config. Separate namespace to avoid polluting LibAppStorage.
library LibUniswapV3MockStorage {
	bytes32 constant MOCK_STORAGE_POSITION = keccak256('diamond.uniswap.v3.mock.storage');

	struct MockStorage {
		/// @notice Mintable token to use as output for executeBuy (USDC -> token). Must implement mint(address,uint256).
		address mockTokenForBuy;
		/// @notice Mintable token to use as output for executeSell (token -> USDC). Must implement mint(address,uint256).
		address mockUsdcForSell;
		/// @notice Fixed output ratio: amountOut = amountIn * mockBuyRatio / 1e18. Default 1e18 = 1:1.
		uint256 mockBuyRatio;
		/// @notice Fixed output ratio for sell: amountOut = amountIn * mockSellRatio / 1e18.
		uint256 mockSellRatio;
	}

	function getMockStorage() internal pure returns (MockStorage storage s) {
		bytes32 position = MOCK_STORAGE_POSITION;
		assembly {
			s.slot := position
		}
	}
}
