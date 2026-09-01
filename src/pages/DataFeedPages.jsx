import { useState, useEffect, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass } from '../utils'

// ─── Funding Rates ─────────────────────────────────────────────────────────
// Binance perpetual futures funding rates — GET /fapi/v1/premiumIndex
// (public, no key). Field confirmed: lastFundingRate is a decimal STRING
// like "0.00038246", charged every 8h. Annualized = rate * 3 * 365 * 100.
export function FundingRates() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortDesc, setSortDesc] = useState(true)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex')
      if (!r.ok) throw new Error(`Binance returned ${r.status}`)
      const data = await r.json()
      const usdtOnly = data
        .filter(d => d.symbol.endsWith('USDT'))
        .map(d => {
          const rate = parseFloat(d.lastFundingRate)
          return {
            symbol: d.symbol.replace('USDT', ''),
            markPrice: parseFloat(d.markPrice),
            rate8h: rate * 100,
            rateAnnualized: rate * 3 * 365 * 100,
            nextFundingTime: d.nextFundingTime,
          }
        })
        .filter(d => Number.isFinite(d.rate8h))
      setRates(usdtOnly)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sorted = useMemo(() => {
    return [...rates].sort((a, b) => sortDesc ? b.rate8h - a.rate8h : a.rate8h - b.rate8h)
  }, [rates, sortDesc])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>Binance USDT-M perpetual futures · funding charged every 8h</span>
        <button className="btn btn-ghost" onClick={() => setSortDesc(!sortDesc)} style={{ marginLeft: 'auto' }}>
          {sortDesc ? '↓ Highest first' : '↑ Lowest first'}
        </button>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div className="spinner" /> : error ? (
          <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
        ) : (
          <table>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>Symbol</th><th>Mark Price</th><th>Funding (8h)</th><th>Annualized</th><th>Next Funding</th></tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.symbol}>
                  <td style={{ fontWeight: 700 }}>{r.symbol}</td>
                  <td className="mono">{fmt.price(r.markPrice)}</td>
                  <td className={pctClass(r.rate8h)}>{r.rate8h >= 0 ? '+' : ''}{r.rate8h.toFixed(4)}%</td>
                  <td className={pctClass(r.rateAnnualized)}>{r.rateAnnualized >= 0 ? '+' : ''}{r.rateAnnualized.toFixed(1)}%</td>
                  <td style={{ color: 'var(--text3)', fontSize: 10 }}>{new Date(r.nextFundingTime).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)' }}>
        🟢 Positive = longs pay shorts (bullish crowding) &nbsp;&nbsp; 🔴 Negative = shorts pay longs (bearish crowding)
      </div>
    </div>
  )
}

// ─── DeFi Yield ────────────────────────────────────────────────────────────
// DeFiLlama's public yields API — GET https://yields.llama.fi/pools, no key.
// Confirmed fields: chain, project, symbol, tvlUsd, apyBase, apyReward, apy.
export function DeFiYield() {
  const [pools, setPools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [minTvl, setMinTvl] = useState(1_000_000)
  const [chain, setChain] = useState('All')

  useEffect(() => {
    fetch('https://yields.llama.fi/pools')
      .then(r => r.json())
      .then(d => setPools(d.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const chains = useMemo(() => ['All', ...new Set(pools.map(p => p.chain))].slice(0, 30), [pools])

  const filtered = useMemo(() => {
    return pools
      .filter(p => p.tvlUsd >= minTvl)
      .filter(p => chain === 'All' || p.chain === chain)
      .filter(p => !search || p.symbol?.toLowerCase().includes(search.toLowerCase()) || p.project?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, 100)
  }, [pools, minTvl, chain, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search token or project…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
        <select value={chain} onChange={e => setChain(e.target.value)}>
          {chains.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={minTvl} onChange={e => setMinTvl(Number(e.target.value))}>
          <option value={100000}>Min TVL $100K</option>
          <option value={1000000}>Min TVL $1M</option>
          <option value={10000000}>Min TVL $10M</option>
        </select>
        <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>Source: DeFiLlama · {filtered.length} pools shown</span>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div className="spinner" /> : error ? (
          <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
        ) : (
          <table>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>Pool</th><th style={{ textAlign: 'left' }}>Chain</th><th style={{ textAlign: 'left' }}>Project</th><th>TVL</th><th>APY</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.pool}>
                  <td style={{ fontWeight: 700 }}>{p.symbol}</td>
                  <td style={{ color: 'var(--text2)' }}>{p.chain}</td>
                  <td style={{ color: 'var(--text2)' }}>{p.project}</td>
                  <td className="mono gold">{fmt.large(p.tvlUsd)}</td>
                  <td className={pctClass((p.apy || 0) - 5)} style={{ fontWeight: 700 }}>{(p.apy || 0).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)' }}>
        ⚠ High APY often means high risk (new/unaudited protocols, IL, or unsustainable emissions) — always verify a pool independently before depositing.
      </div>
    </div>
  )
}

// ─── Depeg Monitor ─────────────────────────────────────────────────────────
// Uses CoinGecko's stablecoins category — same API the rest of the app
// already relies on. Flags any stablecoin trading meaningfully off its peg.
export function DepegMonitor() {
  const [coins, setCoins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=stablecoins&order=market_cap_desc&per_page=100&sparkline=false')
      if (!r.ok) throw new Error(`CoinGecko returned ${r.status}`)
      setCoins(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const withDeviation = useMemo(() => {
    return coins
      .filter(c => c.current_price > 0)
      .map(c => ({ ...c, deviationPct: (c.current_price - 1) * 100 }))
      .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))
  }, [coins])

  const depegged = withDeviation.filter(c => Math.abs(c.deviationPct) >= 0.5)
  const stable = withDeviation.filter(c => Math.abs(c.deviationPct) < 0.5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>Top 100 stablecoins by market cap · flag threshold ±0.5%</span>
        <button className="btn btn-ghost" onClick={load} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {loading ? <div className="spinner" /> : error ? (
        <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
      ) : (
        <>
          <div className="card" style={{ padding: 14 }}>
            <div className="card-hd">
              <div className="dot" style={{ background: depegged.length ? 'var(--red)' : 'var(--green)' }} />
              {depegged.length ? `⚠ ${depegged.length} stablecoin(s) off peg` : '✓ All monitored stablecoins holding peg'}
            </div>
            {depegged.length > 0 && (
              <table>
                <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Price</th><th>Deviation</th><th>Market Cap</th></tr></thead>
                <tbody>
                  {depegged.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.symbol.toUpperCase()}</td>
                      <td className="mono">${c.current_price.toFixed(4)}</td>
                      <td className={pctClass(-Math.abs(c.deviationPct))} style={{ fontWeight: 700 }}>{c.deviationPct >= 0 ? '+' : ''}{c.deviationPct.toFixed(3)}%</td>
                      <td className="mono gold">{fmt.large(c.market_cap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ flex: 1, overflow: 'auto' }}>
            <div className="card-hd"><div className="dot" style={{ background: 'var(--gold)' }} />On Peg ({stable.length})</div>
            <table>
              <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Price</th><th>Deviation</th><th>Market Cap</th></tr></thead>
              <tbody>
                {stable.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.symbol.toUpperCase()}</td>
                    <td className="mono">${c.current_price.toFixed(4)}</td>
                    <td className={pctClass(-Math.abs(c.deviationPct))}>{c.deviationPct >= 0 ? '+' : ''}{c.deviationPct.toFixed(3)}%</td>
                    <td className="mono gold">{fmt.large(c.market_cap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Arbitrage Scanner ─────────────────────────────────────────────────────
// Uses CoinGecko's /coins/{id}/tickers — real exchange-by-exchange prices
// for a given coin. Scans a small, user-picked set of coins on demand
// (not automatically for all 500 — that would hammer the free API rate
// limit) and reports the largest cross-exchange spread found.
export function ArbitrageScanner() {
  const { coins } = useCryptoStore()
  const [selected, setSelected] = useState(['bitcoin', 'ethereum', 'solana', 'ripple'])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const topCoins = useMemo(() => coins.slice(0, 20), [coins])

  const scan = async () => {
    if (!selected.length) return
    setLoading(true); setError(null); setResults([])
    try {
      const out = []
      for (const id of selected) {
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/tickers?include_exchange_logo=false`)
        if (!r.ok) continue
        const d = await r.json()
        const prices = (d.tickers || [])
          .filter(t => t.target === 'USDT' || t.target === 'USD')
          .filter(t => t.converted_last?.usd > 0)
          .map(t => ({ exchange: t.market.name, price: t.converted_last.usd }))
        if (prices.length < 2) continue
        const sorted = [...prices].sort((a, b) => a.price - b.price)
        const low = sorted[0], high = sorted[sorted.length - 1]
        const spreadPct = ((high.price - low.price) / low.price) * 100
        out.push({ id, name: d.name, symbol: d.symbol, low, high, spreadPct, exchangeCount: prices.length })
        // Small delay between coins to stay well within CoinGecko's free-tier
        // rate limit (roughly 10-30 calls/min).
        await new Promise(res => setTimeout(res, 1500))
      }
      setResults(out.sort((a, b) => b.spreadPct - a.spreadPct))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 8 ? [...s, id] : s)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>SELECT UP TO 8 COINS TO SCAN (real exchange prices, checked one at a time to respect API limits)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {topCoins.map(c => (
            <button key={c.id} className={`btn ${selected.includes(c.id) ? 'btn-gold' : 'btn-ghost'}`} onClick={() => toggle(c.id)}>
              {c.symbol.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="btn btn-green" onClick={scan} disabled={loading || !selected.length} style={{ marginTop: 10 }}>
          {loading ? `Scanning… (${results.length}/${selected.length})` : `Scan ${selected.length} Coin(s)`}
        </button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        {error && <div className="empty" style={{ padding: 20 }}>⚠ {error}</div>}
        {!error && !results.length && !loading && <div className="empty" style={{ padding: 40 }}>Pick coins above and hit Scan — checks real prices across every exchange CoinGecko tracks for each coin</div>}
        {results.length > 0 && (
          <table>
            <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Lowest</th><th>Highest</th><th>Spread</th><th>Exchanges</th></tr></thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.symbol.toUpperCase()}</td>
                  <td className="mono">{fmt.price(r.low.price)} <span style={{ color: 'var(--text3)', fontSize: 9 }}>{r.low.exchange}</span></td>
                  <td className="mono">{fmt.price(r.high.price)} <span style={{ color: 'var(--text3)', fontSize: 9 }}>{r.high.exchange}</span></td>
                  <td className={pctClass(r.spreadPct - 0.3)} style={{ fontWeight: 700 }}>{r.spreadPct.toFixed(3)}%</td>
                  <td style={{ color: 'var(--text3)' }}>{r.exchangeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)' }}>
        ⚠ Spreads shown are gross — they don't account for trading fees, withdrawal fees, or transfer time, which usually exceed small spreads in practice.
      </div>
    </div>
  )
}
