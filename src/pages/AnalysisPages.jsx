import { useState, useEffect, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass } from '../utils'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

// ─── Price Ticker ──────────────────────────────────────────────────────────
// Horizontally scrolling marquee, built purely from data already in the
// store (no extra API calls). CSS animation loops a duplicated list so the
// scroll is seamless.
export function PriceTicker() {
  const { coins, fetchCoins } = useCryptoStore()
  const [count, setCount] = useState(40)

  useEffect(() => { fetchCoins() }, [])

  const list = coins.slice(0, count)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.5px' }}>SHOW</span>
        {[20, 40, 80].map(n => (
          <button key={n} className={`btn ${count === n ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setCount(n)}>{n}</button>
        ))}
        <button className="btn btn-ghost" onClick={() => fetchCoins(true)} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: '14px 0' }}>
        {!list.length ? <div className="spinner" /> : (
          <div className="ticker-track">
            {[...list, ...list].map((c, i) => (
              <div key={c.id + '-' + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 20px', borderRight: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{c.symbol.toUpperCase()}</span>
                <span className="mono" style={{ fontSize: 12 }}>{fmt.price(c.current_price)}</span>
                <span className={pctClass(c.price_change_percentage_24h)} style={{ fontSize: 11 }}>{fmt.pct(c.price_change_percentage_24h)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 45s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        <table>
          <thead><tr><th style={{ textAlign: 'left' }}>#</th><th style={{ textAlign: 'left' }}>Coin</th><th>Price</th><th>24h</th><th>Market Cap</th></tr></thead>
          <tbody>
            {list.map((c, i) => (
              <tr key={c.id}>
                <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                <td style={{ fontWeight: 700 }}>{c.symbol.toUpperCase()} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{c.name}</span></td>
                <td className="mono">{fmt.price(c.current_price)}</td>
                <td className={pctClass(c.price_change_percentage_24h)}>{fmt.pct(c.price_change_percentage_24h)}</td>
                <td className="mono gold">{fmt.large(c.market_cap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Multi Chart ───────────────────────────────────────────────────────────
// Grid of small 7d sparkline charts, using sparkline_in_7d.price which
// CoinGecko already returns on the /coins/markets call the store makes
// (sparkline=true) — no extra fetches needed.
export function MultiChart() {
  const { coins, fetchCoins, watchlist } = useCryptoStore()
  const [source, setSource] = useState('top') // 'top' | 'watchlist'
  const [cols, setCols] = useState(4)

  useEffect(() => { fetchCoins() }, [])

  const list = useMemo(() => {
    const base = source === 'watchlist' ? coins.filter(c => watchlist.has(c.id)) : coins.slice(0, 12)
    return base
  }, [coins, watchlist, source])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['top', 'watchlist'].map(s => (
          <button key={s} className={`btn ${source === s ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setSource(s)}>
            {s === 'top' ? 'Top 12' : `Watchlist (${watchlist.size})`}
          </button>
        ))}
        <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 12 }}>COLUMNS</span>
        {[2, 3, 4].map(n => (
          <button key={n} className={`btn ${cols === n ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setCols(n)}>{n}</button>
        ))}
      </div>

      {!list.length ? (
        <div className="empty" style={{ paddingTop: 60 }}>
          {source === 'watchlist' ? 'No coins in watchlist yet — star some from the Market page' : 'Loading…'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, overflow: 'auto' }}>
          {list.map(c => {
            const spark = c.sparkline_in_7d?.price || []
            const chartData = spark.map((v, i) => ({ i, v }))
            const up = (c.price_change_percentage_7d_in_currency ?? 0) >= 0
            return (
              <div key={c.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{c.symbol.toUpperCase()}</div>
                    <div className="mono" style={{ fontSize: 13 }}>{fmt.price(c.current_price)}</div>
                  </div>
                  <span className={pctClass(c.price_change_percentage_7d_in_currency)} style={{ fontSize: 11 }}>
                    {fmt.pct(c.price_change_percentage_7d_in_currency)}
                  </span>
                </div>
                <div style={{ height: 50 }}>
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <YAxis domain={['dataMin', 'dataMax']} hide />
                        <Line type="monotone" dataKey="v" stroke={up ? 'var(--green)' : 'var(--red)'} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="empty" style={{ fontSize: 9 }}>No sparkline data</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Correlation Matrix ────────────────────────────────────────────────────
// Pearson correlation coefficient between coins' 7d sparkline price series.
// Computed entirely client-side from data already fetched — genuinely
// accurate math, not a simulation, though limited to whatever the 7d
// sparkline window covers (CoinGecko doesn't give us more history for free).
function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 2) return null
  const av = a.slice(0, n), bv = b.slice(0, n)
  const meanA = av.reduce((s, v) => s + v, 0) / n
  const meanB = bv.reduce((s, v) => s + v, 0) / n
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < n; i++) {
    const da = av[i] - meanA, db = bv[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const den = Math.sqrt(denA * denB)
  return den === 0 ? 0 : num / den
}

export function CorrelationMatrix() {
  const { coins, fetchCoins } = useCryptoStore()
  const [count, setCount] = useState(10)

  useEffect(() => { fetchCoins() }, [])

  const list = useMemo(() => coins.filter(c => (c.sparkline_in_7d?.price?.length || 0) > 1).slice(0, count), [coins, count])

  const matrix = useMemo(() => {
    return list.map(rowCoin => list.map(colCoin => {
      if (rowCoin.id === colCoin.id) return 1
      return pearson(rowCoin.sparkline_in_7d.price, colCoin.sparkline_in_7d.price)
    }))
  }, [list])

  const colorFor = (v) => {
    if (v == null) return 'var(--bg3)'
    const intensity = Math.min(Math.abs(v), 1)
    return v >= 0
      ? `rgba(77,255,110,${0.1 + intensity * 0.5})`
      : `rgba(255,77,77,${0.1 + intensity * 0.5})`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.5px' }}>COINS</span>
        {[8, 10, 15].map(n => (
          <button key={n} className={`btn ${count === n ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setCount(n)}>{n}</button>
        ))}
        <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>7-day price correlation — computed from live sparkline data</span>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {!list.length ? <div className="spinner" /> : (
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th></th>
                {list.map(c => (
                  <th key={c.id} style={{ fontSize: 9, padding: 6, writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{c.symbol.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((rowCoin, ri) => (
                <tr key={rowCoin.id}>
                  <td style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', textAlign: 'right' }}>{rowCoin.symbol.toUpperCase()}</td>
                  {list.map((colCoin, ci) => {
                    const v = matrix[ri][ci]
                    return (
                      <td key={colCoin.id} title={`${rowCoin.symbol.toUpperCase()} vs ${colCoin.symbol.toUpperCase()}: ${v == null ? 'n/a' : v.toFixed(2)}`}
                        style={{ width: 42, height: 32, background: colorFor(v), textAlign: 'center', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', border: '1px solid var(--bg)' }}>
                        {v == null ? '—' : v.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>
        🟢 Positive correlation (move together) &nbsp;&nbsp; 🔴 Negative correlation (move opposite) &nbsp;&nbsp; Darker = stronger
      </div>
    </div>
  )
}

// ─── Breakout Scanner ──────────────────────────────────────────────────────
// Flags coins trading within a tight % band of their 24h high (bullish
// breakout candidates) or 24h low (breakdown candidates), and separately
// flags unusually large 24h moves. All computed from existing coin fields
// (high_24h / low_24h / current_price / price_change_percentage_24h) —
// no extra API calls, no simulated data.
export function BreakoutScanner() {
  const { coins, fetchCoins } = useCryptoStore()
  const [band, setBand] = useState(1.5) // % distance from high/low to qualify

  useEffect(() => { fetchCoins() }, [])

  const { breakouts, breakdowns, movers } = useMemo(() => {
    const withRange = coins.filter(c => c.high_24h && c.low_24h && c.current_price)
    const breakouts = withRange
      .map(c => ({ ...c, distPct: ((c.high_24h - c.current_price) / c.high_24h) * 100 }))
      .filter(c => c.distPct >= 0 && c.distPct <= band)
      .sort((a, b) => a.distPct - b.distPct)
    const breakdowns = withRange
      .map(c => ({ ...c, distPct: ((c.current_price - c.low_24h) / c.low_24h) * 100 }))
      .filter(c => c.distPct >= 0 && c.distPct <= band)
      .sort((a, b) => a.distPct - b.distPct)
    const movers = [...coins]
      .filter(c => c.price_change_percentage_24h != null)
      .sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
      .slice(0, 15)
    return { breakouts: breakouts.slice(0, 15), breakdowns: breakdowns.slice(0, 15), movers }
  }, [coins, band])

  const Section = ({ title, dotColor, rows, distLabel }) => (
    <div className="card" style={{ flex: 1, overflow: 'auto' }}>
      <div className="card-hd"><div className="dot" style={{ background: dotColor }} />{title} ({rows.length})</div>
      <table>
        <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Price</th><th>24h</th><th>{distLabel}</th></tr></thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 700 }}>{c.symbol.toUpperCase()}</td>
              <td className="mono">{fmt.price(c.current_price)}</td>
              <td className={pctClass(c.price_change_percentage_24h)}>{fmt.pct(c.price_change_percentage_24h)}</td>
              <td className="mono gold">{c.distPct.toFixed(2)}%</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="empty">None within {band}% right now</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.5px' }}>BAND</span>
        {[0.5, 1, 1.5, 3].map(b => (
          <button key={b} className={`btn ${band === b ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setBand(b)}>{b}%</button>
        ))}
        <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>Coins within the selected % of their 24h high/low</span>
      </div>

      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
        <Section title="🟢 Near 24h High (Breakout Watch)" dotColor="var(--green)" rows={breakouts} distLabel="Dist. to High" />
        <Section title="🔴 Near 24h Low (Breakdown Watch)" dotColor="var(--red)" rows={breakdowns} distLabel="Dist. to Low" />
      </div>

      <div className="card" style={{ maxHeight: 220, overflow: 'auto' }}>
        <div className="card-hd"><div className="dot" style={{ background: 'var(--gold)' }} />⚡ Biggest 24h Movers</div>
        <table>
          <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Price</th><th>24h Change</th></tr></thead>
          <tbody>
            {movers.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 700 }}>{c.symbol.toUpperCase()}</td>
                <td className="mono">{fmt.price(c.current_price)}</td>
                <td className={pctClass(c.price_change_percentage_24h)} style={{ fontWeight: 700 }}>{fmt.pct(c.price_change_percentage_24h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
