use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    prelude::*,
    storage::StorageAddress,
};

use crate::interfaces::IERC20;

// ─── DEX interface ───────────────────────────────────────────────────────────

sol_interface! {
    interface ICamelotV3Router {
        function exactInputSingle(
            (
                address,
                address,
                address,
                uint256, // deadline
                uint256, // amountIn
                uint256, // amountOutMinimum
                uint160
            ) calldata params
        ) external payable returns (uint256 amountOut);
    }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

/// Adapter that routes swaps through Camelot V3.
/// Deploy this contract, then call `DexRouter.setAdapter(id, address)`.
#[storage]
#[cfg_attr(feature = "contract-camelot", entrypoint)]
pub struct CamelotAdapter {
    owner: StorageAddress,
    router: StorageAddress,
}

// ─── Public ABI ──────────────────────────────────────────────────────────────

#[public]
impl CamelotAdapter {
    pub fn initialize(&mut self, router: Address) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err(b"already initialized".to_vec());
        }
        self.owner.set(self.vm().msg_sender());
        self.router.set(router);
        Ok(())
    }

    /// Called by DexRouter. Pulls tokenIn (router approved us), swaps via
    /// Camelot, sends tokenOut back to the router (msg.sender).
    pub fn swap(
        &mut self,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        min_out: U256,
        deadline: U256,
    ) -> Result<U256, Vec<u8>> {
        let caller = self.vm().msg_sender();       // DexRouter address
        let self_addr = self.vm().contract_address();
        let router_addr = self.router.get();

        // Pull tokenIn from DexRouter (it approved us)
        let call = Call::new_mutating(self);
        IERC20::new(token_in).transfer_from(self.vm(), call, caller, self_addr, amount_in)?;

        // Approve Camelot
        let call = Call::new_mutating(self);
        IERC20::new(token_in).approve(self.vm(), call, router_addr, amount_in)?;

        // Swap — tokenOut goes directly to the DexRouter
        let call = Call::new_mutating(self);
        let amount_out = ICamelotV3Router::new(router_addr).exact_input_single(
            self.vm(),
            call,
            (
                token_in,
                token_out,
                caller,   // recipient = DexRouter
                deadline,
                amount_in,
                min_out,
                stylus_sdk::alloy_primitives::U160::ZERO,
            ),
        )?;

        // Reset approval
        let call = Call::new_mutating(self);
        IERC20::new(token_in).approve(self.vm(), call, router_addr, U256::ZERO)?;

        Ok(amount_out)
    }

    pub fn set_router(&mut self, router: Address) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(b"not owner".to_vec());
        }
        self.router.set(router);
        Ok(())
    }

    pub fn get_router(&self) -> Address { self.router.get() }
    pub fn get_owner(&self) -> Address { self.owner.get() }
}
