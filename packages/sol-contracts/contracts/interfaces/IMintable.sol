// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface for mock tokens that support minting (e.g. MockERC20).
interface IMintable {
	function mint(address to, uint256 amount) external;
}
