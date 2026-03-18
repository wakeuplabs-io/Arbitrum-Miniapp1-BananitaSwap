// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum FacetCutAction {
	Add,
	Replace,
	Remove
}

struct FacetCut {
	address facetAddress;
	FacetCutAction action;
	bytes4[] functionSelectors;
}

interface IDiamondCut {
	event DiamondCut(FacetCut[] diamondCut, address init, bytes calldata_);

	function diamondCut(FacetCut[] calldata diamondCut, address init, bytes calldata data) external;
}
