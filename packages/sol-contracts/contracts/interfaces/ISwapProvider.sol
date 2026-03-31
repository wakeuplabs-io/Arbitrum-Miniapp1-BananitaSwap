// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Provider facet interface: called by Router via delegatecall.
/// ExecuteBuy: swap USDC (already in Diamond) for token; output sent to Diamond.
/// ExecuteSell: swap token (already in Diamond) for USDC; output sent to Diamond.
interface ISwapProvider {
	function executeBuy(address token, uint256 usdcAmount, uint256 minTokenOut, uint256 deadline)
		external
		returns (uint256 amountOut);

	function executeSell(address token, uint256 tokenAmount, uint256 minUsdcOut, uint256 deadline)
		external
		returns (uint256 amountOut);
}
