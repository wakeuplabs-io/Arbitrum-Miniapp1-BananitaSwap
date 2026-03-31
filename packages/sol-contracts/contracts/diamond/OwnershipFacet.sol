// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC173 } from '../interfaces/IERC173.sol';
import { LibAppStorage } from '../libraries/LibAppStorage.sol';

/// @title OwnershipFacet
/// @notice Exposes owner and transferOwnership from app storage.
contract OwnershipFacet is IERC173 {
	function owner() external view override returns (address owner_) {
		return LibAppStorage.getAppStorage().owner;
	}

	function transferOwnership(address newOwner) external override {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		require(msg.sender == s.owner, 'Ownership: not owner');
		address prev = s.owner;
		s.owner = newOwner;
		emit OwnershipTransferred(prev, newOwner);
	}
}
