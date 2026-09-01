// ── 0G Storage integration ───────────────────────────────────────────
// Uploads JSON blobs (DCA plans, backtest results, journal exports) to
// 0G Storage so they're persistent and verifiable beyond one browser's
// localStorage. Uses 0G Storage's REST gateway per the SDK/quick-start
// docs: https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
//
// NOTE: verify GATEWAY_URL against current 0G Storage docs before
// mainnet use — this points at the documented public indexer endpoint
// pattern, but endpoints do change.

const GATEWAY_URL = 'https://indexer-storage-testnet-turbo.0g.ai' // VERIFY current mainnet indexer URL in 0G docs
const EXPLORER_BASE = 'https://storagescan.0g.ai' // VERIFY current 0G Storage explorer URL

/**
 * Upload a JSON-serializable object to 0G Storage.
 * Returns { rootHash, explorerUrl } on success.
 */
export async function uploadToZeroGStorage(data, label = 'onyxlock-data') {
  const payload = JSON.stringify(data)
  const blob = new Blob([payload], { type: 'application/json' })

  const form = new FormData()
  form.append('file', blob, `${label}-${Date.now()}.json`)

  const res = await fetch(`${GATEWAY_URL}/file`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(`0G Storage upload failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  // 0G Storage returns a root hash identifying the uploaded content.
  const rootHash = json.rootHash || json.root_hash || json.hash
  if (!rootHash) throw new Error('0G Storage did not return a root hash')

  return {
    rootHash,
    explorerUrl: `${EXPLORER_BASE}/tx/${rootHash}`,
  }
}

/** Fetch previously uploaded JSON back from 0G Storage by root hash. */
export async function fetchFromZeroGStorage(rootHash) {
  const res = await fetch(`${GATEWAY_URL}/file?root=${rootHash}`)
  if (!res.ok) throw new Error(`0G Storage fetch failed: ${res.status}`)
  return await res.json()
}
