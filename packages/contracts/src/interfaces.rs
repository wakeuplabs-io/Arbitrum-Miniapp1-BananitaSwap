use stylus_sdk::prelude::*;

sol_interface! {
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function approve(address spender, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }

    /// Common interface every DEX adapter must implement.
    interface IDexAdapter {
        function swap(
            address tokenIn,
            address tokenOut,
            uint256 amountIn,
            uint256 minOut,
            uint256 deadline
        ) external returns (uint256 amountOut);
    }
}
