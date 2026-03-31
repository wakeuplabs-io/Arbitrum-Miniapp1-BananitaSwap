use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    prelude::*,
    storage::{StorageAddress, StorageMap, StorageU256},
};

use crate::interfaces::{IDexAdapter, IERC20};

// ─── Storage ─────────────────────────────────────────────────────────────────

/// Fee-taking swap router. Delegates swaps to registered DEX adapters.
/// Add a new DEX: deploy its adapter contract, then call `setAdapter(id, addr)`.
#[storage]
#[cfg_attr(feature = "contract-router", entrypoint)]
pub struct DexRouter {
    owner: StorageAddress,
    usdc: StorageAddress,
    fee_bps: StorageU256,
    fee_recipient: StorageAddress,
    /// provider_id (u8 cast to U256) → adapter contract address
    adapters: StorageMap<U256, StorageAddress>,
}

// ─── Public ABI ──────────────────────────────────────────────────────────────

#[public]
impl DexRouter {
    /// One-time setup. Caller becomes owner.
    pub fn initialize(
        &mut self,
        usdc: Address,
        fee_bps: U256,
        fee_recipient: Address,
    ) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err(b"already initialized".to_vec());
        }
        if fee_bps > U256::from(10_000u32) {
            return Err(b"fee too high".to_vec());
        }
        self.owner.set(self.vm().msg_sender());
        self.usdc.set(usdc);
        self.fee_bps.set(fee_bps);
        self.fee_recipient.set(fee_recipient);
        Ok(())
    }

    /// Buy `token` with USDC via the adapter identified by `provider_id`.
    /// Fee is deducted from the USDC amount before swapping.
    pub fn buy(
        &mut self,
        token: Address,
        usdc_amount: U256,
        min_token_out: U256,
        provider_id: u8,
        deadline: U256,
    ) -> Result<U256, Vec<u8>> {
        let sender = self.vm().msg_sender();
        let contract_addr = self.vm().contract_address();
        let usdc_addr = self.usdc.get();

        let call = Call::new_mutating(self);
        IERC20::new(usdc_addr).transfer_from(self.vm(), call, sender, contract_addr, usdc_amount)?;

        let net_amount = self.deduct_fee(usdc_addr, usdc_amount)?;

        let amount_out =
            self.do_swap(provider_id, usdc_addr, token, net_amount, min_token_out, deadline)?;

        let call = Call::new_mutating(self);
        IERC20::new(token).transfer(self.vm(), call, sender, amount_out)?;

        Ok(amount_out)
    }

    /// Sell `token` for USDC via the adapter identified by `provider_id`.
    /// Fee is deducted from the USDC received after swapping.
    pub fn sell(
        &mut self,
        token: Address,
        token_amount: U256,
        min_usdc_out: U256,
        provider_id: u8,
        deadline: U256,
    ) -> Result<U256, Vec<u8>> {
        let sender = self.vm().msg_sender();
        let contract_addr = self.vm().contract_address();
        let usdc_addr = self.usdc.get();

        let call = Call::new_mutating(self);
        IERC20::new(token).transfer_from(self.vm(), call, sender, contract_addr, token_amount)?;

        let usdc_out =
            self.do_swap(provider_id, token, usdc_addr, token_amount, min_usdc_out, deadline)?;

        let net_usdc = self.deduct_fee(usdc_addr, usdc_out)?;

        let call = Call::new_mutating(self);
        IERC20::new(usdc_addr).transfer(self.vm(), call, sender, net_usdc)?;

        Ok(net_usdc)
    }

    // ── Admin (owner-only) ────────────────────────────────────────────────

    /// Register or replace the adapter for a given provider id.
    pub fn set_adapter(&mut self, id: u8, adapter: Address) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        self.adapters.setter(U256::from(id)).set(adapter);
        Ok(())
    }

    /// Remove an adapter (sets its address to zero).
    pub fn remove_adapter(&mut self, id: u8) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        self.adapters.setter(U256::from(id)).set(Address::ZERO);
        Ok(())
    }

    pub fn set_fee_bps(&mut self, fee_bps: U256) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        if fee_bps > U256::from(10_000u32) {
            return Err(b"fee too high".to_vec());
        }
        self.fee_bps.set(fee_bps);
        Ok(())
    }

    pub fn set_fee_recipient(&mut self, recipient: Address) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        self.fee_recipient.set(recipient);
        Ok(())
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        self.owner.set(new_owner);
        Ok(())
    }

    // ── Views ─────────────────────────────────────────────────────────────

    pub fn get_owner(&self) -> Address { self.owner.get() }
    pub fn get_usdc(&self) -> Address { self.usdc.get() }
    pub fn get_fee_bps(&self) -> U256 { self.fee_bps.get() }
    pub fn get_fee_recipient(&self) -> Address { self.fee_recipient.get() }
    pub fn get_adapter(&self, id: u8) -> Address { self.adapters.get(U256::from(id)) }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

impl DexRouter {
    fn only_owner(&self) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(b"not owner".to_vec());
        }
        Ok(())
    }

    fn deduct_fee(&mut self, token: Address, amount: U256) -> Result<U256, Vec<u8>> {
        let fee_bps = self.fee_bps.get();
        let fee_recipient = self.fee_recipient.get();

        if fee_bps == U256::ZERO || fee_recipient == Address::ZERO {
            return Ok(amount);
        }

        let fee = amount * fee_bps / U256::from(10_000u32);
        if fee > U256::ZERO {
            let call = Call::new_mutating(self);
            IERC20::new(token).transfer(self.vm(), call, fee_recipient, fee)?;
        }

        Ok(amount - fee)
    }

    fn do_swap(
        &mut self,
        provider_id: u8,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        min_out: U256,
        deadline: U256,
    ) -> Result<U256, Vec<u8>> {
        let adapter_addr = self.adapters.get(U256::from(provider_id));
        if adapter_addr == Address::ZERO {
            return Err(b"adapter not found".to_vec());
        }

        // Approve adapter to pull tokenIn from this contract
        let call = Call::new_mutating(self);
        IERC20::new(token_in).approve(self.vm(), call, adapter_addr, amount_in)?;

        // Adapter pulls tokenIn, swaps, sends tokenOut back to us
        let call = Call::new_mutating(self);
        let amount_out = IDexAdapter::new(adapter_addr).swap(
            self.vm(), call, token_in, token_out, amount_in, min_out, deadline,
        )?;

        // Reset approval
        let call = Call::new_mutating(self);
        IERC20::new(token_in).approve(self.vm(), call, adapter_addr, U256::ZERO)?;

        Ok(amount_out)
    }
}
