use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    prelude::*,
    storage::{StorageAddress, StorageU256},
};

use crate::interfaces::IERC20;

// ─── DEX interface ───────────────────────────────────────────────────────────

// UniswapV3 SwapRouter02 exactInputSingle uses 7-tuple params (no deadline).
// Selector = keccak256("exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))") = 0x414bf389
sol_interface! {
    interface IUniswapV3Router {
        function exactInputSingle(
            (
                address,
                address,
                uint24,
                address,
                uint256, // amountIn
                uint256, // amountOutMinimum
                uint160
            ) calldata params
        ) external payable returns (uint256 amountOut);
    }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

/// Adapter that routes swaps through Uniswap V3 SwapRouter v1.
/// Deploy this contract, then call `DexRouter.setAdapter(id, address)`.
#[storage]
#[cfg_attr(feature = "contract-uniswap-v3", entrypoint)]
pub struct UniswapV3Adapter {
    owner: StorageAddress,
    router: StorageAddress,
    pool_fee: StorageU256, // e.g. 500 = 0.05%, 3000 = 0.3%
}

// ─── Public ABI ──────────────────────────────────────────────────────────────

#[public]
impl UniswapV3Adapter {
    pub fn initialize(&mut self, router: Address, pool_fee: U256) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err(b"already initialized".to_vec());
        }
        self.owner.set(self.vm().msg_sender());
        self.router.set(router);
        self.pool_fee.set(pool_fee);
        Ok(())
    }

    /// Called by DexRouter. Pulls tokenIn (router approved us), swaps via
    /// Uniswap V3, sends tokenOut back to the router (msg.sender).
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
        let pool_fee_raw = self.pool_fee.get().wrapping_to::<u32>();
        let pool_fee = stylus_sdk::alloy_primitives::Uint::<24, 1>::from(pool_fee_raw);

        // Pull tokenIn from DexRouter (it approved us)
        let call = Call::new_mutating(self);
        IERC20::new(token_in).transfer_from(self.vm(), call, caller, self_addr, amount_in)?;

        // Approve Uniswap router
        let call = Call::new_mutating(self);
        IERC20::new(token_in).approve(self.vm(), call, router_addr, amount_in)?;

        // Swap — tokenOut goes directly to the DexRouter
        let call = Call::new_mutating(self);
        let amount_out = IUniswapV3Router::new(router_addr).exact_input_single(
            self.vm(),
            call,
            (
                token_in,
                token_out,
                pool_fee,
                caller,   // recipient = DexRouter
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

    pub fn set_router(&mut self, router: Address, pool_fee: U256) -> Result<(), Vec<u8>> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(b"not owner".to_vec());
        }
        self.router.set(router);
        self.pool_fee.set(pool_fee);
        Ok(())
    }

    pub fn get_router(&self) -> Address { self.router.get() }
    pub fn get_pool_fee(&self) -> U256 { self.pool_fee.get() }
    pub fn get_owner(&self) -> Address { self.owner.get() }
}
