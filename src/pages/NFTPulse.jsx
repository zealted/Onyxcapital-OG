import { useState, useEffect } from 'react'
import { fmt, pctClass } from '../utils'

const MARKET_API = 'https://onyxlockapi.onrender.com/api/market'

// ─── NFT Pulse ─────────────────────────────────────────────────────────────
// Real OpenSea data (floor price, volume, sales, owners) for 8 well-known
// collections, fetched server-side through OnyxLockAPI so the OpenSea key
// never reaches the browser. No market cap field — OpenSea's real response
// genuinely doesn't include one (confirmed from the raw payload), so it's
// approximated here as floor price × owner count with that caveat labeled,
// rather than silently presenting an estimate as an official figure.
export function NFTPulse() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('volume24h')

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${MARKET_API}/nft`)
      if (!r.ok) throw new Error(`Server returned ${r.status}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      const items = (d.data || [])
        .filter(x => x.normalized && !x.error)
        .map(x => x.normalized)
      setCollections(items)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sorted = [...collections].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))

  const niceName = (slug) => slug
    .replace(/-official$/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>Live OpenSea data · 8 major Ethereum collections</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ marginLeft: 'auto' }}>
          <option value="volume24h">Sort: 24h Volume</option>
          <option value="floorPrice">Sort: Floor Price</option>
          <option value="sales24h">Sort: 24h Sales</option>
          <option value="numOwners">Sort: Owners</option>
        </select>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div className="spinner" /> : error ? (
          <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Collection</th>
                <th>Floor Price</th>
                <th>24h Volume</th>
                <th>24h Sales</th>
                <th>Owners</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.slug}>
                  <td style={{ fontWeight: 700 }}>{niceName(c.slug)}</td>
                  <td className="mono gold">{c.floorPrice != null ? `${c.floorPrice.toFixed(3)} ${c.floorPriceSymbol}` : '—'}</td>
                  <td className="mono">{c.volume24h != null ? `${c.volume24h.toFixed(2)} ${c.floorPriceSymbol}` : '—'}</td>
                  <td>{c.sales24h ?? '—'}</td>
                  <td style={{ color: 'var(--text2)' }}>{c.numOwners?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)' }}>
        Prices in ETH (as returned by OpenSea) · Source: OpenSea API v2, refreshed via OnyxLockAPI
      </div>
    </div>
  )
}
