// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from '../interfaces/IERC20.sol';
import { ISwapProvider } from '../interfaces/ISwapProvider.sol';
import { LibAppStorage } from '../libraries/LibAppStorage.sol';

/// @title RouterFacet
/// @notice Single entrypoint for buy/sell. Transfers from user, deducts fee, delegates to provider facet, transfers output to user.
contract RouterFacet {
	error ProviderNotFound();
	error SwapFailed();

	function buy(
		address token,
		uint256 usdcAmount,
		uint256 minTokenOut,
		bytes32 providerId,
		uint256 deadline
	) external returns (uint256 amountOut) {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		address provider = s.providerRegistry[providerId];
		require(provider != address(0), 'Router: provider not found');

		IERC20 usdcToken = IERC20(s.usdc);
		uint256 balanceBefore = usdcToken.balanceOf(address(this));
		usdcToken.transferFrom(msg.sender, address(this), usdcAmount);
		uint256 received = usdcToken.balanceOf(address(this)) - balanceBefore;
		require(received > 0, 'Router: no USDC received');
		uint256 amountAfterFee = _deductFee(s, s.usdc, received);

		(bool ok, bytes memory res) = provider.delegatecall(
			abi.encodeWithSelector(
				ISwapProvider.executeBuy.selector,
				token,
				amountAfterFee,
				minTokenOut,
				deadline
			)
		);
		if (!ok) _revert(res);
		amountOut = abi.decode(res, (uint256));

		require(IERC20(token).transfer(msg.sender, amountOut), 'Router: transfer out failed');
		return amountOut;
	}

	function sell(
		address token,
		uint256 tokenAmount,
		uint256 minUsdcOut,
		bytes32 providerId,
		uint256 deadline
	) external returns (uint256 amountOut) {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		address provider = s.providerRegistry[providerId];
		require(provider != address(0), 'Router: provider not found');

		IERC20 tokenContract = IERC20(token);
		uint256 balanceBefore = tokenContract.balanceOf(address(this));
		tokenContract.transferFrom(msg.sender, address(this), tokenAmount);
		uint256 received = tokenContract.balanceOf(address(this)) - balanceBefore;
		require(received > 0, 'Router: no token received');
		uint256 amountAfterFee = _deductFee(s, token, received);

		(bool ok, bytes memory res) = provider.delegatecall(
			abi.encodeWithSelector(
				ISwapProvider.executeSell.selector,
				token,
				amountAfterFee,
				minUsdcOut,
				deadline
			)
		);
		if (!ok) _revert(res);
		amountOut = abi.decode(res, (uint256));

		require(IERC20(s.usdc).transfer(msg.sender, amountOut), 'Router: transfer out failed');
		return amountOut;
	}

	/// @dev Call after pulling tokens to Diamond. Sends fee to feeRecipient and returns amount left for swap.
	function _deductFee(
		LibAppStorage.AppStorage storage s,
		address token,
		uint256 amount
	) internal returns (uint256 amountAfterFee) {
		if (s.feeBps == 0 || s.feeRecipient == address(0)) return amount;
		uint256 fee = (amount * s.feeBps) / 10_000;
		amountAfterFee = amount - fee;
		if (fee > 0) {
			require(IERC20(token).transfer(s.feeRecipient, fee), 'Router: fee transfer failed');
		}
		return amountAfterFee;
	}

	function _revert(bytes memory res) internal pure {
		if (res.length > 0) {
			assembly {
				revert(add(res, 32), mload(res))
			}
		}
		revert('Router: swap failed');
	}

	// --- Admin (owner only) ---

	function setProvider(bytes32 providerId, address facet) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'Router: not owner');
		s.providerRegistry[providerId] = facet;
	}

	function setFee(uint256 feeBps) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'Router: not owner');
		require(feeBps <= 10_000, 'Router: fee too high');
		s.feeBps = feeBps;
	}

	function setFeeRecipient(address feeRecipient) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'Router: not owner');
		s.feeRecipient = feeRecipient;
	}
}
