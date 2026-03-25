// ABI export entrypoint. Run with `cargo run --features export-abi,<contract>`.
//
// Examples:
//   cargo run --features export-abi,contract-router
//   cargo run --no-default-features --features export-abi,contract-camelot
//   cargo run --no-default-features --features export-abi,contract-uniswap-v3
fn main() {
    #[cfg(all(feature = "export-abi", feature = "contract-router"))]
    stylus_sdk::abi::export::print_from_args::<
        arbitrum_miniapp_contracts_stylus::router::DexRouter,
    >();

    #[cfg(all(feature = "export-abi", feature = "contract-camelot"))]
    stylus_sdk::abi::export::print_from_args::<
        arbitrum_miniapp_contracts_stylus::adapters::camelot::CamelotAdapter,
    >();

    #[cfg(all(feature = "export-abi", feature = "contract-uniswap-v3"))]
    stylus_sdk::abi::export::print_from_args::<
        arbitrum_miniapp_contracts_stylus::adapters::uniswap_v3::UniswapV3Adapter,
    >();
}
