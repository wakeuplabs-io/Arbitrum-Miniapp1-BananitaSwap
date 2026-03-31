// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { LibAppStorage } from '../libraries/LibAppStorage.sol';
import { LibUniswapV3MockStorage } from '../libraries/LibUniswapV3MockStorage.sol';
import { IMintable } from '../interfaces/IMintable.sol';

/// @title UniswapV3FacetMock
/// @notice Mock swap provider for testing on Sepolia: mints mock tokens instead of calling Uniswap V3.
/// No pool/router dependency. Use with MockERC20 for both USDC and trade token.
contract UniswapV3FacetMock {
	uint256 constant RATIO_DENOM = 1e18;

	function executeBuy(address token, uint256 usdcAmount, uint256 minTokenOut, uint256 /* deadline */)
		external
		returns (uint256 amountOut)
	{
		LibUniswapV3MockStorage.MockStorage storage mock = LibUniswapV3MockStorage.getMockStorage();
		address mintableToken = mock.mockTokenForBuy;
		require(mintableToken != address(0), 'UniswapV3Mock: mockTokenForBuy not set');
		require(mintableToken == token, 'UniswapV3Mock: token mismatch for buy');

		uint256 ratio = mock.mockBuyRatio == 0 ? RATIO_DENOM : mock.mockBuyRatio;
		amountOut = (usdcAmount * ratio) / RATIO_DENOM;
		if (amountOut < minTokenOut) amountOut = minTokenOut;

		IMintable(mintableToken).mint(address(this), amountOut);
		return amountOut;
	}

	function executeSell(address /* token */, uint256 tokenAmount, uint256 minUsdcOut, uint256 /* deadline */)
		external
		returns (uint256 amountOut)
	{
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		LibUniswapV3MockStorage.MockStorage storage mock = LibUniswapV3MockStorage.getMockStorage();
		address mintableUsdc = mock.mockUsdcForSell;
		require(mintableUsdc != address(0), 'UniswapV3Mock: mockUsdcForSell not set');
		require(mintableUsdc == s.usdc, 'UniswapV3Mock: usdc mismatch for sell');

		uint256 ratio = mock.mockSellRatio == 0 ? RATIO_DENOM : mock.mockSellRatio;
		amountOut = (tokenAmount * ratio) / RATIO_DENOM;
		if (amountOut < minUsdcOut) amountOut = minUsdcOut;

		IMintable(mintableUsdc).mint(address(this), amountOut);
		return amountOut;
	}

	// --- Admin (owner only) ---

	function setMockTokenForBuy(address token) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'UniswapV3Mock: not owner');
		LibUniswapV3MockStorage.getMockStorage().mockTokenForBuy = token;
	}

	function setMockUsdcForSell(address token) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'UniswapV3Mock: not owner');
		LibUniswapV3MockStorage.getMockStorage().mockUsdcForSell = token;
	}

	function setMockBuyRatio(uint256 ratioE18) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'UniswapV3Mock: not owner');
		LibUniswapV3MockStorage.getMockStorage().mockBuyRatio = ratioE18;
	}

	function setMockSellRatio(uint256 ratioE18) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'UniswapV3Mock: not owner');
		LibUniswapV3MockStorage.getMockStorage().mockSellRatio = ratioE18;
	}

	function getMockConfig() external view returns (address mockTokenForBuy, address mockUsdcForSell, uint256 mockBuyRatio, uint256 mockSellRatio) {
		LibUniswapV3MockStorage.MockStorage storage m = LibUniswapV3MockStorage.getMockStorage();
		return (m.mockTokenForBuy, m.mockUsdcForSell, m.mockBuyRatio, m.mockSellRatio);
	}
}
