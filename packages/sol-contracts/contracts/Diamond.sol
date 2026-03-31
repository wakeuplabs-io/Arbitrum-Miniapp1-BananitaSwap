// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FacetCut } from './interfaces/IDiamondCut.sol';
import { LibDiamond } from './libraries/LibDiamond.sol';

/// @title Diamond
/// @notice EIP-2535 Diamond proxy: fallback delegates to facets via selector mapping.
/// Initial facets and init are applied in the constructor (no owner check for first cut).
contract Diamond {
	constructor(FacetCut[] memory cuts, address init, bytes memory data) {
		LibDiamond.diamondCut(cuts, init, data);
	}

	fallback() external payable {
		address facet = LibDiamond.getDiamondStorage().selectorToFacet[msg.sig];
		require(facet != address(0), 'Diamond: selector not found');
		assembly {
			calldatacopy(0, 0, calldatasize())
			let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
			returndatacopy(0, 0, returndatasize())
			switch result
			case 0 { revert(0, returndatasize()) }
			default { return(0, returndatasize()) }
		}
	}

	receive() external payable {}
}
