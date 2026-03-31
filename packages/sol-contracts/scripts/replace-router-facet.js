/**
 * Replace the router-facet selectors on the Stylus Diamond proxy.
 *
 * Use this after deploying a new router-facet binary (e.g. after fixing the
 * ISwapProvider selector mismatch). It performs:
 *   - REPLACE (action=1) on the 6 existing router selectors
 *   - ADD    (action=0) on the new set_camelot_router selector
 *
 * Usage (from packages/sol-contracts):
 *   node scripts/replace-router-facet.js
 *
 * Required env vars:
 *   PRIVATE_KEY            — deployer private key (hex)
 *   NEW_ROUTER_FACET       — address of the newly deployed router-facet
 *
 * Optional env vars:
 *   DIAMOND                — override Diamond proxy address
 *   ARBITRUM_RPC_URL       — RPC endpoint (default: Arbitrum One)
 *   ARBITRUM_SEPOLIA_RPC_URL — use Sepolia RPC
 *   DEPLOYMENTS_JSON       — path to deployments JSON (default: ../rust-contracts/deployments-arbitrum-one.json)
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config()

const { ethers } = require('ethers')

// Selectors that already exist on the Diamond (REPLACE action=1)
const EXISTING_ROUTER_SELECTORS = [
  '0xd8efc58c', // buy(...)
  '0x548baaf8', // sell(...)
  '0xe7aa1a06', // set_provider(bytes32,address)
  '0x31ace33e', // set_token_whitelist(address,bool)
  '0x1aa02d59', // set_fee(uint256)
  '0x30cc317b', // set_fee_recipient(address)
]

// New selector added in this version of router-facet (ADD action=0)
const NEW_ROUTER_SELECTORS = [
  '0x95281d42', // set_camelot_router(address)
]

const DIAMOND_CUT_ABI = [
  'function diamondCut(tuple(address facetAddress,uint8 action,bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata) external',
]

const LOUPE_ABI = [
  'function facet_address(bytes4 selector) view returns (address facet)',
]

async function main() {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) throw new Error('Set PRIVATE_KEY in .env')

  const newRouterFacet = process.env.NEW_ROUTER_FACET
  if (!newRouterFacet) throw new Error('Set NEW_ROUTER_FACET to the newly deployed router-facet address')

  const rpcUrl =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    process.env.ARBITRUM_RPC_URL ||
    'https://arb1.arbitrum.io/rpc'

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const signer = new ethers.Wallet(privateKey, provider)
  const network = await provider.getNetwork()

  const depPath =
    process.env.DEPLOYMENTS_JSON ||
    path.join(__dirname, '../..', 'rust-contracts', 'deployments-arbitrum-one.json')
  const dep = JSON.parse(fs.readFileSync(depPath, 'utf8'))

  const diamondAddress = process.env.DIAMOND || dep.diamond
  if (!diamondAddress) throw new Error('Missing diamond address')

  console.log('Network chainId:', Number(network.chainId))
  console.log('Diamond:        ', diamondAddress)
  console.log('New router:     ', newRouterFacet)
  console.log('Signer:         ', signer.address)

  // Sanity-check: verify one existing selector is already mapped
  try {
    const loupe = new ethers.Contract(diamondAddress, LOUPE_ABI, provider)
    const current = await loupe.facet_address(EXISTING_ROUTER_SELECTORS[0])
    console.log('Current buy() facet:', current)
    if (current === ethers.ZeroAddress) {
      console.warn('WARNING: buy() selector not currently mapped — consider using ADD instead of REPLACE')
    }
  } catch {
    console.log('Loupe check skipped')
  }

  const cuts = [
    // REPLACE existing selectors → new router-facet address
    {
      facetAddress: newRouterFacet,
      action: 1, // REPLACE
      functionSelectors: EXISTING_ROUTER_SELECTORS,
    },
    // ADD new set_camelot_router selector
    {
      facetAddress: newRouterFacet,
      action: 0, // ADD
      functionSelectors: NEW_ROUTER_SELECTORS,
    },
  ]

  const iface = new ethers.Interface(DIAMOND_CUT_ABI)
  const data = iface.encodeFunctionData('diamondCut', [cuts, ethers.ZeroAddress, '0x'])

  console.log('\nSending diamondCut (REPLACE existing + ADD set_camelot_router)...')
  const tx = await signer.sendTransaction({ to: diamondAddress, data })
  console.log('Tx hash:', tx.hash)
  const rec = await tx.wait()
  console.log('Mined in block:', rec.blockNumber)
  console.log('\nDone. Next: call set_camelot_router(<camelot_router_address>) on the Diamond.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
