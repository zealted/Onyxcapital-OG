import { useState, useEffect, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass } from '../utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// ─── Backtester ────────────────────────────────────────────────────────────
// Real backtest using CoinGecko's historical daily price data
// (/coins/{id}/market_chart, free, no key). Strategy: SMA crossover — go
// long when the short SMA crosses above the long SMA, exit when it crosses
// back below. This is genuine, deterministic math over real historical
// prices — not a simulated/fake result.
function sma(values, period, i) {
  if (i < period - 1) return null
  let sum = 0
  for (let k = i - period + 1; k <= i; k++) sum += values[k]
  return sum / period
}

function runBacktest(prices, shortP, longP, startCapital) {
  const closes = prices.map(p => p[1])
  const dates = prices.map(p => p[0])
  let cash = startCapital
  let coins = 0
  let inPosition = false
  const trades = []
  const equityCurve = []

  for (let i = 0; i < closes.length; i++) {
    const shortSma = sma(closes, shortP, i)
    const longSma = sma(closes, longP, i)
    const prevShort = sma(closes, shortP, i - 1)
    const prevLong = sma(closes, longP, i - 1)

    if (shortSma != null && longSma != null && prevShort != null && prevLong != null) {
      const crossUp = prevShort <= prevLong && shortSma > longSma
      const crossDown = prevShort >= prevLong && shortSma < longSma

      if (crossUp && !inPosition) {
        coins = cash / closes[i]
        cash = 0
        inPosition = true
        trades.push({ type: 'BUY', date: dates[i], price: closes[i] })
      } else if (crossDown && inPosition) {
        cash = coins * closes[i]
        const entry = trades[trades.length - 1]
        trades.push({ type: 'SELL', date: dates[i], price: closes[i], pnlPct: ((closes[i] - entry.price) / entry.price) * 100 })
        coins = 0
        inPosition = false
      }
    }

    const equity = inPosition ? coins * closes[i] : cash
    equityCurve.push({ date: dates[i], equity })
  }

  if (inPosition) {
    const lastPrice = closes[closes.length - 1]
    cash = coins * lastPrice
    const entry = trades[trades.length - 1]
    trades.push({ type: 'SELL (period end)', date: dates[dates.length - 1], price: lastPrice, pnlPct: ((lastPrice - entry.price) / entry.price) * 100 })
  }

  const finalEquity = cash || coins * closes[closes.length - 1]
  const totalReturnPct = ((finalEquity - startCapital) / startCapital) * 100
  const buyHoldReturnPct = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100

  let peak = -Infinity, maxDrawdownPct = 0
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity
    const dd = ((pt.equity - peak) / peak) * 100
    if (dd < maxDrawdownPct) maxDrawdownPct = dd
  }

  const closedTrades = trades.filter(t => t.pnlPct != null)
  const wins = closedTrades.filter(t => t.pnlPct > 0).length

  return {
    equityCurve, trades, finalEquity, totalReturnPct, buyHoldReturnPct, maxDrawdownPct,
    tradeCount: closedTrades.length,
    winRate: closedTrades.length ? (wins / closedTrades.length) * 100 : 0,
  }
}

export function Backtester() {
  const { coins } = useCryptoStore()
  const [coinId, setCoinId] = useState('bitcoin')
  const [days, setDays] = useState(365)
  const [shortP, setShortP] = useState(10)
  const [longP, setLongP] = useState(30)
  const [capital, setCapital] = useState(10000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const topCoins = useMemo(() => coins.slice(0, 30), [coins])

  const run = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`)
      if (!r.ok) throw new Error(`CoinGecko returned ${r.status}`)
      const d = await r.json()
      if (!d.prices || d.prices.length < longP + 5) throw new Error('Not enough historical data for this window/period combo')
      setResult(runBacktest(d.prices, shortP, longP, capital))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const chartData = result?.equityCurve.filter((_, i) => i % Math.max(1, Math.floor(result.equityCurve.length / 200)) === 0)
    .map(pt => ({ date: new Date(pt.date).toLocaleDateString(), equity: pt.equity })) || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>SMA CROSSOVER STRATEGY · REAL HISTORICAL PRICES (CoinGecko, daily) · NOT FINANCIAL ADVICE</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={coinId} onChange={e => setCoinId(e.target.value)}>
            {topCoins.map(c => <option key={c.id} value={c.id}>{c.symbol.toUpperCase()}</option>)}
          </select>
          <label style={{ fontSize: 10, color: 'var(--text2)' }}>Window
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ marginLeft: 6 }}>
              <option value={90}>90d</option><option value={180}>180d</option><option value={365}>1y</option><option value={730}>2y</option>
            </select>
          </label>
          <label style={{ fontSize: 10, color: 'var(--text2)' }}>Short SMA
            <input type="number" value={shortP} onChange={e => setShortP(Number(e.target.value))} style={{ width: 50, marginLeft: 6 }} />
          </label>
          <label style={{ fontSize: 10, color: 'var(--text2)' }}>Long SMA
            <input type="number" value={longP} onChange={e => setLongP(Number(e.target.value))} style={{ width: 50, marginLeft: 6 }} />
          </label>
          <label style={{ fontSize: 10, color: 'var(--text2)' }}>Capital
            <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} style={{ width: 80, marginLeft: 6 }} />
          </label>
          <button className="btn btn-green" onClick={run} disabled={loading}>{loading ? 'Running…' : 'Run Backtest'}</button>
        </div>
      </div>

      {error && <div className="card empty" style={{ padding: 20 }}>⚠ {error}</div>}

      {result && (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>STRATEGY RETURN</div>
              <div className={pctClass(result.totalReturnPct)} style={{ fontSize: 20, fontWeight: 700 }}>{result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(1)}%</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>BUY & HOLD RETURN</div>
              <div className={pctClass(result.buyHoldReturnPct)} style={{ fontSize: 20, fontWeight: 700 }}>{result.buyHoldReturnPct >= 0 ? '+' : ''}{result.buyHoldReturnPct.toFixed(1)}%</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>MAX DRAWDOWN</div>
              <div className="dn" style={{ fontSize: 20, fontWeight: 700 }}>{result.maxDrawdownPct.toFixed(1)}%</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>TRADES / WIN RATE</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{result.tradeCount} <span style={{ fontSize: 12, color: 'var(--text3)' }}>/ {result.winRate.toFixed(0)}%</span></div>
            </div>
          </div>

          <div className="card" style={{ height: 240, padding: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text3)' }} minTickGap={40} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} domain={['dataMin', 'dataMax']} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 11 }} formatter={v => fmt.large(v)} />
                <Line type="monotone" dataKey="equity" stroke="var(--gold)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ flex: 1, overflow: 'auto', maxHeight: 200 }}>
            <table>
              <thead><tr><th style={{ textAlign: 'left' }}>Type</th><th style={{ textAlign: 'left' }}>Date</th><th>Price</th><th>P&L</th></tr></thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: t.type.startsWith('BUY') ? 'var(--green)' : 'var(--red)' }}>{t.type}</td>
                    <td style={{ color: 'var(--text2)' }}>{new Date(t.date).toLocaleDateString()}</td>
                    <td className="mono">{fmt.price(t.price)}</td>
                    <td className={t.pnlPct != null ? pctClass(t.pnlPct) : ''}>{t.pnlPct != null ? `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!result && !error && !loading && (
        <div className="empty" style={{ padding: 60 }}>Pick a coin and parameters, then Run Backtest — computes a real SMA crossover strategy against real historical daily prices.</div>
      )}
    </div>
  )
}

// ─── Global Macro ──────────────────────────────────────────────────────────
// Crypto Fear & Greed Index (alternative.me, free, no key — confirmed
// fields: value, value_classification, timestamp) plus CoinGecko's global
// market snapshot (already used elsewhere in this app).
export function GlobalMacro() {
  const { global, fetchGlobal } = useCryptoStore()
  const [fng, setFng] = useState(null)
  const [fngHistory, setFngHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchGlobal()
    fetch('https://api.alternative.me/fng/?limit=30')
      .then(r => r.json())
      .then(d => {
        setFng(d.data[0])
        setFngHistory([...d.data].reverse().map(x => ({
          date: new Date(Number(x.timestamp) * 1000).toLocaleDateString(),
          value: Number(x.value),
        })))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const gaugeColor = (v) => {
    if (v <= 24) return 'var(--red)'
    if (v <= 44) return '#ff8c42'
    if (v <= 55) return 'var(--gold)'
    if (v <= 75) return '#8fd14f'
    return 'var(--green)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {loading ? <div className="spinner" /> : error ? (
        <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="card" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>FEAR & GREED INDEX</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: gaugeColor(Number(fng?.value)) }}>{fng?.value}</div>
              <div style={{ fontSize: 12, color: gaugeColor(Number(fng?.value)), fontWeight: 700 }}>{fng?.value_classification}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 6 }}>Source: alternative.me · updated daily</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>TOTAL MARKET CAP</div>
              <div style={{ fontSize: 24, fontWeight: 700 }} className="gold">{fmt.large(global?.total_market_cap?.usd)}</div>
              <div className={pctClass(global?.market_cap_change_percentage_24h_usd)} style={{ fontSize: 12, marginTop: 4 }}>
                {global?.market_cap_change_percentage_24h_usd >= 0 ? '+' : ''}{global?.market_cap_change_percentage_24h_usd?.toFixed(2)}% (24h)
              </div>
            </div>
            <div className="card" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>BTC DOMINANCE</div>
              <div style={{ fontSize: 24, fontWeight: 700 }} className="gold">{global?.market_cap_percentage?.btc?.toFixed(1)}%</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>ETH: {global?.market_cap_percentage?.eth?.toFixed(1)}%</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>24H VOLUME</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt.large(global?.total_volume?.usd)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{global?.active_cryptocurrencies?.toLocaleString()} active coins</div>
            </div>
          </div>

          <div className="card" style={{ flex: 1, padding: 12 }}>
            <div className="card-hd"><div className="dot" style={{ background: 'var(--gold)' }} />Fear & Greed — Last 30 Days</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={fngHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text3)' }} minTickGap={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text3)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
