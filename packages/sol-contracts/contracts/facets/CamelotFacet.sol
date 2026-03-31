// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from '../interfaces/IERC20.sol';
import { ICamelotV3Router, ExactInputSingleParams } from '../interfaces/ICamelotV3Router.sol';
import { LibAppStorage } from '../libraries/LibAppStorage.sol';

/// @title CamelotFacet
/// @notice Swap provider: executeBuy (USDC -> token) and executeSell (token -> USDC) via Camelot V3.
/// Tokens are already in the Diamond; this facet approves router and performs exactInputSingle.
contract CamelotFacet {
	function executeBuy(address token, uint256 usdcAmount, uint256 minTokenOut, uint256 deadline)
		external
		returns (uint256 amountOut)
	{
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		address usdc = s.usdc;
		address router = s.camelotRouter;
		require(router != address(0), 'Camelot: router not set');

		_resetAndApprove(usdc, router, usdcAmount);

		ExactInputSingleParams memory params = ExactInputSingleParams({
			tokenIn: usdc,
			tokenOut: token,
			recipient: address(this),
			deadline: deadline,
			amountIn: usdcAmount,
			amountOutMinimum: minTokenOut,
			sqrtPriceLimitX96: 0
		});
		return ICamelotV3Router(router).exactInputSingle(params);
	}

	function executeSell(address token, uint256 tokenAmount, uint256 minUsdcOut, uint256 deadline)
		external
		returns (uint256 amountOut)
	{
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		address usdc = s.usdc;
		address router = s.camelotRouter;
		require(router != address(0), 'Camelot: router not set');

		_resetAndApprove(token, router, tokenAmount);

		ExactInputSingleParams memory params = ExactInputSingleParams({
			tokenIn: token,
			tokenOut: usdc,
			recipient: address(this),
			deadline: deadline,
			amountIn: tokenAmount,
			amountOutMinimum: minUsdcOut,
			sqrtPriceLimitX96: 0
		});
		return ICamelotV3Router(router).exactInputSingle(params);
	}

	function _resetAndApprove(address token, address spender, uint256 amount) internal {
		IERC20 t = IERC20(token);
		uint256 current = t.allowance(address(this), spender);
		if (current != 0) {
			require(t.approve(spender, 0), 'Camelot: approve 0 failed');
		}
		require(t.approve(spender, amount), 'Camelot: approve failed');
	}
}
