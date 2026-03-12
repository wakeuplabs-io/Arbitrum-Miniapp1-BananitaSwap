//!
//! Arbitrum Stylus contracts: EIP-2535 Diamond proxy.
//!
//! The Diamond is the main entrypoint. It routes calls to facets via selector → facet mapping
//! using delegatecall. Unregistered selectors revert.
//!
// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

use stylus_sdk::{
	alloy_primitives::{Address, FixedBytes},
	call::{delegate_call, Error as CallError},
	prelude::*,
};

use stylus_sdk::alloy_primitives::U256;

// EIP-2535 Diamond: fallback delegates to facets via selector → facet mapping.
sol_storage! {
	#[entrypoint]
	pub struct Diamond {
		mapping(bytes4 => address) selector_to_facet;
	}
}

// Error selector for "SelectorNotFound(bytes4)" - used when facet is zero.
fn selector_not_found_error(selector: [u8; 4]) -> Vec<u8> {
	// Minimal revert: just encode selector for debugging. Full ABI encoding would require
	// SolidityError derive. Simple prefix + selector is sufficient for revert.
	let mut out = alloc::vec![0x00; 4];
	out.extend_from_slice(&selector);
	out
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
		let selector_fixed = FixedBytes::from(selector);
		let facet = self.selector_to_facet.get(selector_fixed);
		if facet == Address::ZERO {
			return Err(selector_not_found_error(selector))
		}
		// SAFETY: facet address comes from trusted storage; only registered facets should be set.
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
	fn test_diamond_selector_storage_set_and_get() {
		let vm = TestVM::default();
		let mut diamond = Diamond::from(&vm);
		let selector = FixedBytes::from([0x12u8, 0x34, 0x56, 0x78]);
		let facet = Address::from([1u8; 20]);
		diamond.selector_to_facet.setter(selector).set(facet);
		let read = diamond.selector_to_facet.get(selector);
		assert_eq!(read, facet);
	}
}
