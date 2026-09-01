// ── 0G Chain integration ─────────────────────────────────────────────
// Wraps wallet connection (MetaMask / any EIP-1193 provider) and calls
// into the OnyxLock TradeLog contract deployed on 0G Chain (0G-Aristotle
// mainnet). Values below confirmed against 0G's official chain list.

import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from 'ethers'

export const ZERO_G_CHAIN = {
  chainId: '0x' + Number(16661).toString(16), // 16661 — 0G-Aristotle mainnet
  chainName: '0G-Aristotle',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: ['https://evmrpc.0g.ai'],
  blockExplorerUrls: ['https://chainscan.0g.ai'],
}

export const TRADELOG_CONTRACT_ADDRESS = '' // ← paste deployed address here

const TRADELOG_ABI = [
  'function logTrade(bytes32 tradeHash, string coin, string side) external',
  'function getTradeCount(address trader) external view returns (uint256)',
  'function getTradeHistoryLength(address trader) external view returns (uint256)',
  'event TradeLogged(address indexed trader, bytes32 indexed tradeHash, string coin, string side, uint256 timestamp)',
]

let provider = null
let signer = null

/** Connect the user's wallet and switch/add the 0G Chain network. */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('No wallet found. Install MetaMask to sync trades onchain.')
  }

  await window.ethereum.request({ method: 'eth_requestAccounts' })

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ZERO_G_CHAIN.chainId }],
    })
  } catch (switchError) {
    // Chain not added to wallet yet — add it.
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [ZERO_G_CHAIN],
      })
    } else {
      throw switchError
    }
  }

  provider = new BrowserProvider(window.ethereum)
  signer = await provider.getSigner()
  return await signer.getAddress()
}

export function isWalletConnected() {
  return !!signer
}

function getContract() {
  if (!signer) throw new Error('Wallet not connected')
  if (!TRADELOG_CONTRACT_ADDRESS) throw new Error('TradeLog contract not deployed yet — set TRADELOG_CONTRACT_ADDRESS')
  return new Contract(TRADELOG_CONTRACT_ADDRESS, TRADELOG_ABI, signer)
}

/** Hash a trade object deterministically for onchain storage. */
export function hashTrade(trade) {
  const payload = JSON.stringify({
    coin: trade.coin, side: trade.side, amount: trade.amount,
    price: trade.price, date: trade.date,
  })
  return keccak256(toUtf8Bytes(payload))
}

/**
 * Log a trade to 0G Chain. Returns { txHash, explorerUrl } on success.
 * Caller should treat this as best-effort — the app already records the
 * trade locally, so failures here should never block the trading flow.
 */
export async function logTradeOnChain(trade) {
  const contract = getContract()
  const tradeHash = hashTrade(trade)
  const tx = await contract.logTrade(tradeHash, trade.coin, trade.side)
  const receipt = await tx.wait()
  return {
    txHash: receipt.hash,
    explorerUrl: `${ZERO_G_CHAIN.blockExplorerUrls[0]}/tx/${receipt.hash}`,
  }
}

export async function getOnChainTradeCount(address) {
  const contract = getContract()
  const count = await contract.getTradeCount(address)
  return Number(count)
}
