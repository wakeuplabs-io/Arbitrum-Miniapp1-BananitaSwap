// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Params for Uniswap SwapRouter02 / IV3SwapRouter exactInputSingle (no deadline in struct).
/// Fee in hundredths of bps, e.g. 3000 = 0.3%.
struct ExactInputSingleParams {
	address tokenIn;
	address tokenOut;
	uint24 fee;
	address recipient;
	uint256 amountIn;
	uint256 amountOutMinimum;
	uint160 sqrtPriceLimitX96;
}

interface IUniswapV3Router {
	function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}
