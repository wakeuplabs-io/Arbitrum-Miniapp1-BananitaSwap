// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IDiamondCut, FacetCut, FacetCutAction } from '../interfaces/IDiamondCut.sol';

/// @notice EIP-2535 Diamond: selector → facet mapping for fallback delegation.
library LibDiamond {
	bytes32 constant DIAMOND_STORAGE_POSITION = keccak256('diamond.standard.storage');

	struct DiamondStorage {
		mapping(bytes4 => address) selectorToFacet;
		address[] facetAddresses;
		mapping(address => bytes4[]) facetSelectors;
	}

	function getDiamondStorage() internal pure returns (DiamondStorage storage ds) {
		bytes32 position = DIAMOND_STORAGE_POSITION;
		assembly {
			ds.slot := position
		}
	}

	event DiamondCut(FacetCut[] diamondCut, address init, bytes calldata_);

	function diamondCut(
		FacetCut[] memory cuts,
		address init,
		bytes memory data
	) internal {
		DiamondStorage storage ds = getDiamondStorage();
		for (uint256 i; i < cuts.length; ) {
			address facetAddress = cuts[i].facetAddress;
			bytes4[] memory selectors = cuts[i].functionSelectors;
			FacetCutAction action = cuts[i].action;

			if (action == FacetCutAction.Add) {
				_addFacet(ds, facetAddress, selectors);
			} else if (action == FacetCutAction.Replace) {
				_replaceFacet(ds, facetAddress, selectors);
			} else if (action == FacetCutAction.Remove) {
				_removeFacet(ds, facetAddress, selectors);
			}
			unchecked {
				++i;
			}
		}
		emit DiamondCut(cuts, init, data);
		if (init != address(0)) {
			_initDiamondCut(init, data);
		}
	}

	function _addFacet(DiamondStorage storage ds, address facetAddress, bytes4[] memory selectors) internal {
		require(facetAddress != address(0), 'LibDiamond: add facet is address(0)');
		for (uint256 i; i < selectors.length; ) {
			require(ds.selectorToFacet[selectors[i]] == address(0), 'LibDiamond: selector already added');
			ds.selectorToFacet[selectors[i]] = facetAddress;
			ds.facetSelectors[facetAddress].push(selectors[i]);
			unchecked {
				++i;
			}
		}
		_addFacetAddress(ds, facetAddress);
	}

	function _replaceFacet(DiamondStorage storage ds, address facetAddress, bytes4[] memory selectors) internal {
		for (uint256 i; i < selectors.length; ) {
			address oldFacet = ds.selectorToFacet[selectors[i]];
			require(oldFacet != address(0), 'LibDiamond: replace selector not found');
			_removeSelector(ds, oldFacet, selectors[i]);
			ds.selectorToFacet[selectors[i]] = facetAddress;
			ds.facetSelectors[facetAddress].push(selectors[i]);
			unchecked {
				++i;
			}
		}
		_addFacetAddress(ds, facetAddress);
	}

	function _removeFacet(DiamondStorage storage ds, address facetAddress, bytes4[] memory selectors) internal {
		require(facetAddress == address(0), 'LibDiamond: remove facet must be address(0)');
		for (uint256 i; i < selectors.length; ) {
			address oldFacet = ds.selectorToFacet[selectors[i]];
			require(oldFacet != address(0), 'LibDiamond: remove selector not found');
			_removeSelector(ds, oldFacet, selectors[i]);
			delete ds.selectorToFacet[selectors[i]];
			unchecked {
				++i;
			}
		}
	}

	function _removeSelector(DiamondStorage storage ds, address facet, bytes4 selector) internal {
		bytes4[] storage s = ds.facetSelectors[facet];
		for (uint256 i; i < s.length; ) {
			if (s[i] == selector) {
				s[i] = s[s.length - 1];
				s.pop();
				break;
			}
			unchecked {
				++i;
			}
		}
		if (ds.facetSelectors[facet].length == 0) {
			_removeFacetAddress(ds, facet);
		}
	}

	function _addFacetAddress(DiamondStorage storage ds, address facet) internal {
		for (uint256 i; i < ds.facetAddresses.length; ) {
			if (ds.facetAddresses[i] == facet) return;
			unchecked {
				++i;
			}
		}
		ds.facetAddresses.push(facet);
	}

	function _removeFacetAddress(DiamondStorage storage ds, address facet) internal {
		for (uint256 i; i < ds.facetAddresses.length; ) {
			if (ds.facetAddresses[i] == facet) {
				ds.facetAddresses[i] = ds.facetAddresses[ds.facetAddresses.length - 1];
				ds.facetAddresses.pop();
				break;
			}
			unchecked {
				++i;
			}
		}
	}

	function _initDiamondCut(address init, bytes memory data) internal {
		(bool ok, bytes memory res) = init.delegatecall(data);
		if (!ok) {
			if (res.length > 0) {
				assembly {
					revert(add(res, 32), mload(res))
				}
			}
			revert('LibDiamond: init reverted');
		}
	}
}
