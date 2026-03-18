// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { LibAppStorage } from './libraries/LibAppStorage.sol';

/// @title DiamondInit
/// @notice One-time init called from Diamond constructor. Sets owner, usdc, fee, camelot router.
contract DiamondInit {
	function init(
		address usdc_,
		address feeRecipient_,
		uint256 feeBps_,
		address camelotRouter_
	) external {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(s.owner == address(0), 'DiamondInit: already initialized');
		s.owner = msg.sender;
		s.usdc = usdc_;
		s.feeRecipient = feeRecipient_;
		s.feeBps = feeBps_;
		s.camelotRouter = camelotRouter_;
	}
}
