// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from '../interfaces/IERC20.sol';

contract MockERC20 is IERC20 {
	string public name;
	string public symbol;
	uint8 public decimals = 18;
	mapping(address => uint256) public balanceOf;
	mapping(address => mapping(address => uint256)) public allowance;

	constructor(string memory name_, string memory symbol_) {
		name = name_;
		symbol = symbol_;
	}

	function transfer(address to, uint256 amount) external returns (bool) {
		balanceOf[msg.sender] -= amount;
		balanceOf[to] += amount;
		return true;
	}

	function transferFrom(address from, address to, uint256 amount) external returns (bool) {
		if (allowance[from][msg.sender] != type(uint256).max) {
			allowance[from][msg.sender] -= amount;
		}
		balanceOf[from] -= amount;
		balanceOf[to] += amount;
		return true;
	}

	function approve(address spender, uint256 amount) external returns (bool) {
		allowance[msg.sender][spender] = amount;
		return true;
	}

	function mint(address to, uint256 amount) external {
		balanceOf[to] += amount;
	}
}
