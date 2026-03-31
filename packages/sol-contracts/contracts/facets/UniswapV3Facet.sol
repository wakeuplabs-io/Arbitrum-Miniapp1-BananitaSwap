// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from '../interfaces/IERC20.sol';
import { IUniswapV3Router, ExactInputSingleParams } from '../interfaces/IUniswapV3Router.sol';
import { LibAppStorage } from '../libraries/LibAppStorage.sol';

/// @title UniswapV3Facet
/// @notice Swap provider: executeBuy (USDC -> token) and executeSell (token -> USDC) via Uniswap V3.
/// Tokens are already in the Diamond; this facet approves router and performs exactInputSingle.
contract UniswapV3Facet {
	function executeBuy(address token, uint256 usdcAmount, uint256 minTokenOut)
		external
		returns (uint256 amountOut)
	{
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		address usdc = s.usdc;
		address router = s.uniswapV3Router;
		require(router != address(0), 'UniswapV3: router not set');
		require(s.uniswapV3PoolFee != 0, 'UniswapV3: pool fee not set');

		_resetAndApprove(usdc, router, usdcAmount);

		ExactInputSingleParams memory params = ExactInputSingleParams({
			tokenIn: usdc,
			tokenOut: token,
			fee: s.uniswapV3PoolFee,
			recipient: address(this),
			amountIn: usdcAmount,
			amountOutMinimum: minTokenOut,
			sqrtPriceLimitX96: 0
		});
		return IUniswapV3Router(router).exactInputSingle(params);
	}

	function executeSell(address token, uint256 tokenAmount, uint256 minUsdcOut, uint256 /* deadline */)
		external
		returns (uint256 amountOut)
	{
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		address usdc = s.usdc;
		address router = s.uniswapV3Router;
		require(router != address(0), 'UniswapV3: router not set');
		require(s.uniswapV3PoolFee != 0, 'UniswapV3: pool fee not set');

		_resetAndApprove(token, router, tokenAmount);

		ExactInputSingleParams memory params = ExactInputSingleParams({
			tokenIn: token,
			tokenOut: usdc,
			fee: s.uniswapV3PoolFee,
			recipient: address(this),
			amountIn: tokenAmount,
			amountOutMinimum: minUsdcOut,
			sqrtPriceLimitX96: 0
		});
		return IUniswapV3Router(router).exactInputSingle(params);
	}

	function _resetAndApprove(address token, address spender, uint256 amount) internal {
		IERC20 t = IERC20(token);
		uint256 current = t.allowance(address(this), spender);
		if (current != 0) {
			require(t.approve(spender, 0), 'UniswapV3: approve 0 failed');
		}
		require(t.approve(spender, amount), 'UniswapV3: approve failed');
	}

	// --- Admin (owner only) ---

	function setUniswapV3Router(address router) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'UniswapV3: not owner');
		s.uniswapV3Router = router;
	}

	function setUniswapV3PoolFee(uint24 fee) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'UniswapV3: not owner');
		s.uniswapV3PoolFee = fee;
	}
}
