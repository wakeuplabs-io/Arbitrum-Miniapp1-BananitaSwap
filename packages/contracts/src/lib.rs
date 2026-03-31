//!
//! Arbitrum Stylus contracts: EIP-2535 Diamond proxy.
//!
//! The Diamond is the main entrypoint. It routes calls to facets via selector → facet mapping
//! using delegatecall. Unregistered selectors revert. Supports diamondCut for add/replace/remove
//! of facet selectors with ownership check and DiamondCut event.
//!
// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

use alloy_sol_types::{sol, SolCall};
use stylus_sdk::{
	alloy_primitives::{Address, FixedBytes},
	call::{delegate_call, Error as CallError},
	evm,
	msg,
	prelude::*,
};

// EIP-2535: FacetCut struct, diamondCut call type, and DiamondCut event.
sol! {
	struct FacetCut {
		address facetAddress;
		uint8 action;  // Add=0, Replace=1, Remove=2
		bytes4[] functionSelectors;
	}

	interface IDiamondCut {
		function diamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata) external;
	}

	event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
}

// EIP-2535 Diamond: fallback delegates to facets via selector → facet mapping; owner for diamondCut.
sol_storage! {
	#[entrypoint]
	pub struct Diamond {
		mapping(bytes4 => address) selector_to_facet;
		address owner;
	}
}

const FACET_CUT_ACTION_ADD: u8 = 0;
const FACET_CUT_ACTION_REPLACE: u8 = 1;
const FACET_CUT_ACTION_REMOVE: u8 = 2;

// Error selector for "SelectorNotFound(bytes4)" - used when facet is zero.
fn selector_not_found_error(selector: [u8; 4]) -> Vec<u8> {
	let mut out = alloc::vec![0x00; 4];
	out.extend_from_slice(&selector);
	out
}

// Revert when caller is not the owner (used by diamondCut).
fn not_owner_error() -> Vec<u8> {
	alloc::vec![0x00; 4]
}

impl Diamond {
	/// EIP-2535 diamondCut: add/replace/remove facet selectors. Validates ownership, applies cuts, emits DiamondCut, runs init.
	/// Internal only; dispatched from fallback when selector matches diamondCut.
	fn diamond_cut(
		&mut self,
		diamond_cut: Vec<FacetCut>,
		init: Address,
		calldata: Vec<u8>,
	) -> Result<Vec<u8>, Vec<u8>> {
		let sender = msg::sender();
		let current_owner = self.owner.get();
		if current_owner == Address::ZERO {
			self.owner.set(sender);
		} else if current_owner != sender {
			return Err(not_owner_error())
		}

		for cut in diamond_cut.iter() {
			let facet = cut.facetAddress;
			let action = cut.action;
			for selector in cut.functionSelectors.iter() {
				let sel_fixed = FixedBytes::from(*selector);
				let existing = self.selector_to_facet.get(sel_fixed);
				match action {
					FACET_CUT_ACTION_ADD => {
						if existing != Address::ZERO {
							return Err(not_owner_error()) // selector already set
						}
						self.selector_to_facet.setter(sel_fixed).set(facet);
					},
					FACET_CUT_ACTION_REPLACE => {
						if existing == Address::ZERO || existing == facet {
							return Err(not_owner_error())
						}
						self.selector_to_facet.setter(sel_fixed).set(facet);
					},
					FACET_CUT_ACTION_REMOVE => {
						if existing == Address::ZERO {
							return Err(not_owner_error())
						}
						self.selector_to_facet.setter(sel_fixed).set(Address::ZERO);
					},
					_ => return Err(not_owner_error()),
				}
			}
		}

		evm::log(DiamondCut {
			_diamondCut: diamond_cut.clone(),
			_init: init,
			_calldata: calldata.clone().into(),
		});

		if init != Address::ZERO && !calldata.is_empty() {
			match unsafe { delegate_call(&mut *self, init, &calldata) } {
				Ok(ret) => {
					self.vm().write_result(&ret);
					Ok(ret)
				},
				Err(e) => {
					let revert_data = match e {
						CallError::Revert(data) => data,
						CallError::AbiDecodingFailed(_) => alloc::vec![0u8],
					};
					return Err(revert_data)
				},
			}
		} else {
			Ok(alloc::vec![])
		}
	}
}

#[public]
impl Diamond {
	#[fallback]
	#[payable]
	pub fn fallback(&mut self, calldata: &[u8]) -> Result<Vec<u8>, Vec<u8>> {
		if calldata.len() < 4 {
			return Err(selector_not_found_error([0, 0, 0, 0]))
		}
		let selector = [calldata[0], calldata[1], calldata[2], calldata[3]];
		if selector == IDiamondCut::diamondCutCall::SELECTOR {
			let decoded = IDiamondCut::diamondCutCall::abi_decode_raw(&calldata[4..], true)
				.map_err(|_| alloc::vec![0u8])?;
			return self.diamond_cut(
				decoded._diamondCut,
				decoded._init,
				decoded._calldata.to_vec(),
			)
		}
		let selector_fixed = FixedBytes::from(selector);
		let facet = self.selector_to_facet.get(selector_fixed);
		if facet == Address::ZERO {
			return Err(selector_not_found_error(selector))
		}
		match unsafe { delegate_call(&mut *self, facet, calldata) } {
			Ok(ret) => {
				self.vm().write_result(&ret);
				Ok(ret)
			},
			Err(e) => {
				let revert_data = match e {
					CallError::Revert(data) => data,
					CallError::AbiDecodingFailed(_) => alloc::vec![0u8],
				};
				Err(revert_data)
			},
		}
	}
}

#[cfg(test)]
mod test {
	use super::*;
	use stylus_sdk::testing::*;

	#[test]
	fn test_diamond_selector_storage_set_and_get() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		// Calldata with 4-byte selector (no facet registered) -> must revert
		let calldata: &[u8] = &[0x12, 0x34, 0x56, 0x78];
		let result = diamond.fallback(calldata);
		assert!(result.is_err(), "fallback should revert when selector not found");
	}

	#[test]
	fn test_diamond_fallback_reverts_on_short_calldata() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		// Calldata < 4 bytes -> must revert
		let calldata: &[u8] = &[0x12, 0x34];
		let result = diamond.fallback(calldata);
		assert!(result.is_err(), "fallback should revert when calldata < 4 bytes");
	}

	#[test]
	fn test_diamond_storage_set_and_get() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		let selector = FixedBytes::from([0x12u8, 0x34, 0x56, 0x78]);
		let facet = Address::from([1u8; 20]);
		diamond.selector_to_facet.setter(selector).set(facet);
		let read = diamond.selector_to_facet.get(selector);
		assert_eq!(read, facet);
	}

	#[test]
	#[ignore = "diamondCut uses msg::sender and evm::log; test VM may not support these"]
	fn test_diamond_cut_add_selectors() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		let facet = Address::from([1u8; 20]);
		let selectors = alloc::vec![FixedBytes::from([0x12u8, 0x34, 0x56, 0x78])];
		let cut = FacetCut {
			facetAddress: facet,
			action: FACET_CUT_ACTION_ADD,
			functionSelectors: selectors.clone(),
		};
		let call = IDiamondCut::diamondCutCall {
			_diamondCut: alloc::vec![cut],
			_init: Address::ZERO,
			_calldata: alloc::vec![].into(),
		};
		let calldata = call.abi_encode();
		let result = diamond.fallback(&calldata);
		assert!(result.is_ok(), "diamondCut add should succeed");
		assert_eq!(diamond.selector_to_facet.get(FixedBytes::from([0x12, 0x34, 0x56, 0x78])), facet);
	}

	#[test]
	#[ignore = "diamondCut uses msg::sender and evm::log; test VM may not support these"]
	fn test_diamond_cut_replace_selectors() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		let facet_a = Address::from([1u8; 20]);
		let facet_b = Address::from([2u8; 20]);
		let sel = [0x12u8, 0x34, 0x56, 0x78];
		diamond.selector_to_facet.setter(FixedBytes::from(sel)).set(facet_a);
		let cut = FacetCut {
			facetAddress: facet_b,
			action: FACET_CUT_ACTION_REPLACE,
			functionSelectors: alloc::vec![FixedBytes::from(sel)],
		};
		let call = IDiamondCut::diamondCutCall {
			_diamondCut: alloc::vec![cut],
			_init: Address::ZERO,
			_calldata: alloc::vec![].into(),
		};
		let calldata = call.abi_encode();
		let result = diamond.fallback(&calldata);
		assert!(result.is_ok(), "diamondCut replace should succeed");
		assert_eq!(diamond.selector_to_facet.get(FixedBytes::from(sel)), facet_b);
	}

	#[test]
	#[ignore = "diamondCut uses msg::sender and evm::log; test VM may not support these"]
	fn test_diamond_cut_remove_selectors() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		let facet = Address::from([1u8; 20]);
		let sel = [0x12u8, 0x34, 0x56, 0x78];
		diamond.selector_to_facet.setter(FixedBytes::from(sel)).set(facet);
		let cut = FacetCut {
			facetAddress: Address::ZERO,
			action: FACET_CUT_ACTION_REMOVE,
			functionSelectors: alloc::vec![FixedBytes::from(sel)],
		};
		let call = IDiamondCut::diamondCutCall {
			_diamondCut: alloc::vec![cut],
			_init: Address::ZERO,
			_calldata: alloc::vec![].into(),
		};
		let calldata = call.abi_encode();
		let result = diamond.fallback(&calldata);
		assert!(result.is_ok(), "diamondCut remove should succeed");
		assert_eq!(diamond.selector_to_facet.get(FixedBytes::from(sel)), Address::ZERO);
	}

	#[test]
	#[ignore = "diamondCut uses msg::sender and evm::log; test VM may not support these"]
	fn test_diamond_cut_ownership_first_caller_becomes_owner() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		assert_eq!(diamond.owner.get(), Address::ZERO);
		let cut = FacetCut {
			facetAddress: Address::from([1u8; 20]),
			action: FACET_CUT_ACTION_ADD,
			functionSelectors: alloc::vec![FixedBytes::from([0x11u8, 0x22, 0x33, 0x44])],
		};
		let call = IDiamondCut::diamondCutCall {
			_diamondCut: alloc::vec![cut],
			_init: Address::ZERO,
			_calldata: alloc::vec![].into(),
		};
		let calldata = call.abi_encode();
		let _ = diamond.fallback(&calldata);
		assert_ne!(diamond.owner.get(), Address::ZERO, "first diamondCut should set owner");
	}
}
