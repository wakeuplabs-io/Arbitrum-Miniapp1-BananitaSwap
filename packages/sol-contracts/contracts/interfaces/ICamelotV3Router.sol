// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct ExactInputSingleParams {
	address tokenIn;
	address tokenOut;
	address recipient;
	uint256 deadline;
	uint256 amountIn;
	uint256 amountOutMinimum;
	uint160 sqrtPriceLimitX96;
}

interface ICamelotV3Router {
	function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}
