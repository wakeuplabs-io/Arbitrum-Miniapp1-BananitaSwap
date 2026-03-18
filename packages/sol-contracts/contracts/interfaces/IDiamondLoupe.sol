// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct Facet {
	address facetAddress;
	bytes4[] functionSelectors;
}

interface IDiamondLoupe {
	function facets() external view returns (Facet[] memory facets_);
	function facetAddress(bytes4 selector) external view returns (address facet);
	function facetAddresses() external view returns (address[] memory);
	function facetFunctionSelectors(address facet) external view returns (bytes4[] memory);
}
