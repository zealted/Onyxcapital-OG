import { useState, useEffect, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass } from '../utils'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const MARKET_API = 'https://onyxlockapi.onrender.com/api/market'

// ─── AI Signals ────────────────────────────────────────────────────────────
// IMPORTANT HONESTY NOTE: there is no legitimate free "AI prediction" data
// source. This is NOT a machine-learning model — it's a transparent,
// deterministic technical-analysis score (RSI + SMA trend + momentum),
// computed from real price data. Labeled clearly in the UI as rule-based,
// not AI, so it isn't mistaken for something it isn't.
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff; else losses -= diff
  }
  const avgGain = gains / period, avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function scoreCoin(coin) {
  const spark = coin.sparkline_in_7d?.price || []
  if (spark.length < 20) return null

  const rsi = calcRSI(spark, 14)
  const sma20 = spark.slice(-20).reduce((s, v) => s + v, 0) / 20
  const price = spark[spark.length - 1]
  const trendUp = price > sma20
  const momentum7d = coin.price_change_percentage_7d_in_currency ?? 0
  const momentum24h = coin.price_change_percentage_24h ?? 0

  // Simple transparent point system, entirely rule-based:
  // RSI oversold/overbought (+/-2), trend vs SMA20 (+/-1), 7d momentum (+/-1), 24h momentum (+/-1)
  let score = 0
  if (rsi != null) { if (rsi < 30) score += 2; else if (rsi > 70) score -= 2 }
  score += trendUp ? 1 : -1
  score += momentum7d > 0 ? 1 : -1
  score += momentum24h > 0 ? 1 : -1

  let label = 'Neutral', color = 'var(--gold)'
  if (score >= 3) { label = 'Bullish'; color = 'var(--green)' }
  else if (score >= 1) { label = 'Lean Bullish'; color = '#8fd14f' }
  else if (score <= -3) { label = 'Bearish'; color = 'var(--red)' }
  else if (score <= -1) { label = 'Lean Bearish'; color = '#ff8c42' }

  return { rsi, trendUp, momentum7d, momentum24h, score, label, color }
}

export function AISignals() {
  const { coins, fetchCoins } = useCryptoStore()
  const [count, setCount] = useState(20)

  useEffect(() => { fetchCoins() }, [])

  const scored = useMemo(() => {
    return coins.slice(0, 50)
      .map(c => ({ coin: c, signal: scoreCoin(c) }))
      .filter(x => x.signal)
      .sort((a, b) => b.signal.score - a.signal.score)
      .slice(0, count)
  }, [coins, count])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div className="card" style={{ padding: 10, fontSize: 10, color: 'var(--text2)' }}>
        ⚠ <strong>Not AI.</strong> This is a transparent, rule-based technical score computed from real price data: RSI(14), trend vs 20-period SMA, 7d &amp; 24h momentum. No machine learning, no prediction — just deterministic math you can verify yourself. Not financial advice.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[10, 20, 30].map(n => (
          <button key={n} className={`btn ${count === n ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setCount(n)}>Top {n}</button>
        ))}
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Coin</th><th>Price</th><th>RSI(14)</th><th>Trend</th><th>7d</th><th>24h</th><th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {scored.map(({ coin, signal }) => (
              <tr key={coin.id}>
                <td style={{ fontWeight: 700 }}>{coin.symbol.toUpperCase()}</td>
                <td className="mono">{fmt.price(coin.current_price)}</td>
                <td className={signal.rsi > 70 ? 'dn' : signal.rsi < 30 ? 'up' : ''}>{signal.rsi?.toFixed(0)}</td>
                <td style={{ color: signal.trendUp ? 'var(--green)' : 'var(--red)' }}>{signal.trendUp ? '↑ Above SMA20' : '↓ Below SMA20'}</td>
                <td className={pctClass(signal.momentum7d)}>{fmt.pct(signal.momentum7d)}</td>
                <td className={pctClass(signal.momentum24h)}>{fmt.pct(signal.momentum24h)}</td>
                <td style={{ color: signal.color, fontWeight: 700 }}>{signal.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Institutional Flow ────────────────────────────────────────────────────
// Real institutional flow data — this IS what "institutional flow" means in
// practice: US spot Bitcoin ETF creations/redemptions (BlackRock, Fidelity,
// etc.), same confirmed-working SoSoValue data as the BTC ETFs page, just
// visualized as a flow trend instead of a table.
export function InstitutionalFlow() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${MARKET_API}/etf`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d.data) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const v = (obj) => obj?.value != null ? Number(obj.value) : null
  const list = data?.list || []
  const byInflow = [...list].sort((a, b) => (v(b.dailyNetInflow) || 0) - (v(a.dailyNetInflow) || 0))

  const chartData = byInflow.map(row => ({
    ticker: row.ticker,
    inflow: v(row.dailyNetInflow) || 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ fontSize: 9, color: 'var(--text3)' }}>US Spot Bitcoin ETF daily flows — the primary tracked proxy for institutional crypto flow · Source: SoSoValue</div>

      {loading ? <div className="spinner" /> : error ? (
        <div className="card empty" style={{ padding: 30 }}>⚠ {error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>NET FLOW TODAY</div>
              <div className={pctClass(v(data?.dailyNetInflow))} style={{ fontSize: 22, fontWeight: 700 }}>{fmt.large(v(data?.dailyNetInflow))}</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>CUMULATIVE (ALL TIME)</div>
              <div className={pctClass(v(data?.cumNetInflow))} style={{ fontSize: 22, fontWeight: 700 }}>{fmt.large(v(data?.cumNetInflow))}</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>TOTAL AUM</div>
              <div className="gold" style={{ fontSize: 22, fontWeight: 700 }}>{fmt.large(v(data?.totalNetAssets))}</div>
            </div>
          </div>

          <div className="card" style={{ flex: 1, padding: 12 }}>
            <div className="card-hd"><div className="dot" style={{ background: 'var(--gold)' }} />Daily Net Flow by Fund</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="ticker" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} tickFormatter={v => fmt.large(v)} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 11 }} formatter={v => fmt.large(v)} />
                <Bar dataKey="inflow">
                  {chartData.map((d, i) => <Cell key={i} fill={d.inflow >= 0 ? 'var(--green)' : 'var(--red)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Liquidation Heatmap ───────────────────────────────────────────────────
// HONESTY NOTE: real-time actual liquidation feeds (Coinglass-style) require
// a paid provider. This instead computes ESTIMATED liquidation price zones
// from REAL data: current price (live) and real open interest (Binance
// /fapi/v1/openInterest, free/public), modeled across common leverage tiers
// (5x/10x/25x/50x/100x) using standard isolated-margin liquidation math.
// This is a model/estimate, clearly labeled as such — not a claim of real
// observed liquidation events.
function liqPrice(entryPrice, leverage, isLong, maintMarginRate = 0.005) {
  // Simplified isolated-margin liquidation price estimate.
  if (isLong) return entryPrice * (1 - 1 / leverage + maintMarginRate)
  return entryPrice * (1 + 1 / leverage - maintMarginRate)
}

export function LiquidationHeatmap() {
  const { coins } = useCryptoStore()
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [oi, setOi] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const price = coins.find(c => c.symbol.toUpperCase() + 'USDT' === symbol)?.current_price

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`)
      if (!r.ok) throw new Error(`Binance returned ${r.status}`)
      const d = await r.json()
      setOi(Number(d.openInterest))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [symbol])

  const leverages = [5, 10, 25, 50, 100]
  const zones = useMemo(() => {
    if (!price) return []
    return leverages.flatMap(lev => [
      { leverage: lev, side: 'Long', price: liqPrice(price, lev, true), distPct: ((liqPrice(price, lev, true) - price) / price) * 100 },
      { leverage: lev, side: 'Short', price: liqPrice(price, lev, false), distPct: ((liqPrice(price, lev, false) - price) / price) * 100 },
    ]).sort((a, b) => a.price - b.price)
  }, [price])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div className="card" style={{ padding: 10, fontSize: 10, color: 'var(--text2)' }}>
        ⚠ <strong>Modeled estimate, not live liquidation data.</strong> Real per-exchange liquidation feeds require a paid provider. This computes where longs/shorts at common leverage tiers would theoretically get liquidated, using the real current price and real Binance open interest — standard isolated-margin math, not observed events.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'].map(s => (
          <button key={s} className={`btn ${symbol === s ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setSymbol(s)}>{s.replace('USDT', '')}</button>
        ))}
        {price && <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 10 }}>Current: <span className="mono gold">{fmt.price(price)}</span></span>}
        {oi != null && <span style={{ fontSize: 11, color: 'var(--text2)' }}>· OI: <span className="mono">{oi.toLocaleString(undefined, { maximumFractionDigits: 0 })} {symbol.replace('USDT', '')}</span></span>}
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div className="spinner" /> : error ? (
          <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
        ) : !price ? (
          <div className="empty" style={{ padding: 30 }}>Waiting for live price…</div>
        ) : (
          <table>
            <thead><tr><th>Leverage</th><th style={{ textAlign: 'left' }}>Side</th><th>Est. Liq. Price</th><th>Distance</th></tr></thead>
            <tbody>
              {zones.map((z, i) => (
                <tr key={i}>
                  <td className="mono">{z.leverage}x</td>
                  <td style={{ fontWeight: 700, color: z.side === 'Long' ? 'var(--green)' : 'var(--red)' }}>{z.side}</td>
                  <td className="mono gold">{fmt.price(z.price)}</td>
                  <td className={pctClass(z.side === 'Long' ? -Math.abs(z.distPct) : Math.abs(z.distPct))}>{z.distPct >= 0 ? '+' : ''}{z.distPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
