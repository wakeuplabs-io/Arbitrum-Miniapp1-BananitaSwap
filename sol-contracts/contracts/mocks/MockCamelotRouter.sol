// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from '../interfaces/IERC20.sol';
import { ICamelotV3Router, ExactInputSingleParams } from '../interfaces/ICamelotV3Router.sol';

/// @notice Mock router: pulls tokenIn from caller, sends tokenOut to recipient. Used for tests.
contract MockCamelotRouter is ICamelotV3Router {
	function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256 amountOut) {
		IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
		amountOut = params.amountOutMinimum;
		require(IERC20(params.tokenOut).transfer(params.recipient, amountOut), 'MockRouter: transfer failed');
		return amountOut;
	}
}
