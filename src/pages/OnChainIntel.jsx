import { useState, useEffect } from 'react'
import { fmt } from '../utils'

const MARKET_API = 'https://onyxlockapi.onrender.com/api/market'

// ─── On-Chain Intel ────────────────────────────────────────────────────────
// Real Ethereum mainnet data via OnyxLockAPI -> Etherscan v2 (key stays
// server-side): live gas prices, total ETH supply, and real whale
// transactions (>= threshold ETH) pulled from the last ~20 blocks. Not
// wallet-clustering/entity-attribution data (that needs Glassnode/Nansen,
// paid) — this is genuine raw on-chain activity, which is what's realistically
// available for free.
export function OnChainIntel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${MARKET_API}/onchain`)
      if (!r.ok) throw new Error(`Server returned ${r.status}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setData(d.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const shortAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>Live Ethereum mainnet data · Source: Etherscan · block {data?.latestBlock}</span>
        <button className="btn btn-ghost" onClick={load} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {loading ? <div className="spinner" /> : error ? (
        <div className="card empty" style={{ padding: 30 }}>⚠ {error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>GAS · SAFE</div>
              <div className="up" style={{ fontSize: 20, fontWeight: 700 }}>{data?.gas?.safe?.toFixed(2)} <span style={{ fontSize: 11 }}>Gwei</span></div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>GAS · PROPOSE</div>
              <div className="gold" style={{ fontSize: 20, fontWeight: 700 }}>{data?.gas?.propose?.toFixed(2)} <span style={{ fontSize: 11 }}>Gwei</span></div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>GAS · FAST</div>
              <div className="dn" style={{ fontSize: 20, fontWeight: 700 }}>{data?.gas?.fast?.toFixed(2)} <span style={{ fontSize: 11 }}>Gwei</span></div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>TOTAL ETH SUPPLY</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data?.ethSupply?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          <div className="card" style={{ flex: 1, overflow: 'auto' }}>
            <div className="card-hd">
              <div className="dot" style={{ background: 'var(--cyan)' }} />
              🐋 Whale Transactions (≥ {data?.whaleThresholdEth} ETH · last {data?.blocksScanned} blocks · {data?.totalTxsScanned} txs scanned)
            </div>
            {!data?.whaleTransactions?.length ? (
              <div className="empty" style={{ padding: 30 }}>No transactions ≥ {data?.whaleThresholdEth} ETH in the last {data?.blocksScanned} blocks (~{Math.round((data?.blocksScanned || 0) * 12 / 60)} min). This is genuinely how quiet the network was during this window — not an error.</div>
            ) : (
              <table>
                <thead><tr><th style={{ textAlign: 'left' }}>Hash</th><th style={{ textAlign: 'left' }}>From</th><th style={{ textAlign: 'left' }}>To</th><th>Amount</th></tr></thead>
                <tbody>
                  {data.whaleTransactions.map(tx => (
                    <tr key={tx.hash}>
                      <td className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>{shortAddr(tx.hash)}</td>
                      <td className="mono" style={{ fontSize: 10 }}>{shortAddr(tx.from)}</td>
                      <td className="mono" style={{ fontSize: 10 }}>{shortAddr(tx.to)}</td>
                      <td className="mono gold" style={{ fontWeight: 700 }}>{tx.valueEth.toFixed(2)} ETH</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
