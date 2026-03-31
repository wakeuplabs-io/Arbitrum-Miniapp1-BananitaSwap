// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IDiamondLoupe, Facet } from '../interfaces/IDiamondLoupe.sol';
import { LibDiamond } from '../libraries/LibDiamond.sol';

/// @title DiamondLoupeFacet
/// @notice EIP-2535 Diamond Loupe: introspection of facets and selectors.
contract DiamondLoupeFacet is IDiamondLoupe {
	function facets() external view override returns (Facet[] memory facets_) {
		LibDiamond.DiamondStorage storage ds = LibDiamond.getDiamondStorage();
		uint256 n = ds.facetAddresses.length;
		facets_ = new Facet[](n);
		for (uint256 i; i < n; ) {
			address fa = ds.facetAddresses[i];
			facets_[i] = Facet({ facetAddress: fa, functionSelectors: ds.facetSelectors[fa] });
			unchecked {
				++i;
			}
		}
	}

	function facetAddress(bytes4 selector) external view override returns (address facet) {
		return LibDiamond.getDiamondStorage().selectorToFacet[selector];
	}

	function facetAddresses() external view override returns (address[] memory) {
		return LibDiamond.getDiamondStorage().facetAddresses;
	}

	function facetFunctionSelectors(address facet) external view override returns (bytes4[] memory) {
		return LibDiamond.getDiamondStorage().facetSelectors[facet];
	}
}
