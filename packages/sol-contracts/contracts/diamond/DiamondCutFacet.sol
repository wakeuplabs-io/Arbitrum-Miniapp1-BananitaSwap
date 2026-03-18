// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IDiamondCut, FacetCut } from '../interfaces/IDiamondCut.sol';
import { LibDiamond } from '../libraries/LibDiamond.sol';
import { LibAppStorage } from '../libraries/LibAppStorage.sol';

/// @title DiamondCutFacet
/// @notice EIP-2535 diamondCut: add/replace/remove facet selectors. Owner only (first caller becomes owner).
contract DiamondCutFacet is IDiamondCut {
	function diamondCut(FacetCut[] calldata cuts, address init, bytes calldata data) external override {
		LibAppStorage.AppStorage storage s = LibAppStorage.getAppStorage();
		if (s.owner == address(0)) {
			s.owner = msg.sender;
		} else {
			require(s.owner == msg.sender, 'DiamondCut: not owner');
		}
		LibDiamond.diamondCut(cuts, init, data);
	}
}
