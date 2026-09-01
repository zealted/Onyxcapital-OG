import { useState, useEffect } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass, fetchJson, GECKO, ALT_ME } from '../utils'

// ─── News ────────────────────────────────────────────────────────────────────
// Real news via OnyxLockAPI -> SoSoValue's /news/featured (confirmed
// working, key stays server-side). Replaces the old CryptoPanic call, which
// used a fake "pub_free" token and would never have worked — CryptoPanic's
// free tier was discontinued in April 2026 regardless.
const NEWS_API = 'https://onyxlockapi.onrender.com/api/market/news'

export function News() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${NEWS_API}?pageSize=30`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setItems(d.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const englishOf = (item) => item.multilanguageContent?.find(c => c.language === 'en') || item.multilanguageContent?.[0]

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>
      {loading ? <div className="spinner" /> : error ? (
        <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
      ) : !items.length ? (
        <div className="empty" style={{ padding: 30 }}>No news available right now</div>
      ) : items.map(item => {
        const content = englishOf(item)
        if (!content) return null
        return (
          <div key={item.id} className="card" style={{ marginBottom: 8, padding: '12px 14px' }}>
            <a href={item.sourceLink} target="_blank" rel="noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{content.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>
                {content.content?.slice(0, 220)}{content.content?.length > 220 ? '…' : ''}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{item.author}</span>
                <span>{new Date(item.releaseTime).toLocaleString()}</span>
                {item.tags?.slice(0, 4).map(t => <span key={t} className="badge badge-gold">{t}</span>)}
              </div>
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sentiment ───────────────────────────────────────────────────────────────
export function Sentiment() {
  const [fg, setFg] = useState(null)

  useEffect(() => {
    fetchJson(`${ALT_ME}/fng/?limit=30`)
      .then(d => setFg(d.data))
      .catch(() => {})
  }, [])

  const latest = fg?.[0]
  const val = parseInt(latest?.value || 0)
  const color = val >= 60 ? 'var(--green)' : val >= 40 ? 'var(--gold)' : 'var(--red)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {latest && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8, letterSpacing: '.5px' }}>FEAR & GREED INDEX</div>
            <div style={{ fontSize: 64, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 14, color, marginTop: 4 }}>{latest.value_classification}</div>
          </div>
          <div className="card card-body">
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 12, letterSpacing: '.5px' }}>30-DAY HISTORY</div>
            {fg?.slice(0, 10).map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: 'var(--text3)', width: 70, flexShrink: 0 }}>{new Date(d.timestamp * 1000).toLocaleDateString()}</span>
                <div className="pct-bar" style={{ flex: 1 }}>
                  <div className="pct-bar-fill" style={{ width: d.value + '%', background: parseInt(d.value) >= 60 ? 'var(--green)' : parseInt(d.value) >= 40 ? 'var(--gold)' : 'var(--red)' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: parseInt(d.value) >= 60 ? 'var(--green)' : parseInt(d.value) >= 40 ? 'var(--gold)' : 'var(--red)', width: 30 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Whale Tracker ───────────────────────────────────────────────────────────
// Real Ethereum on-chain data via OnyxLockAPI -> Etherscan (same source as
// the On-Chain Intel page). This used to generate fake events with
// Math.random() — replaced with genuine large ETH transfers pulled from
// recent real blocks.
const MARKET_API = 'https://onyxlockapi.onrender.com/api/market'

export function WhaleTracker() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${MARKET_API}/onchain`)
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

  const shortAddr = (a) => a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—'

  return (
    <div className="card" style={{ height: '100%', overflow: 'auto' }}>
      <div className="card-hd">
        <div className="dot" style={{ background: 'var(--cyan)' }} />
        🐋 Whale Tracker — Real Ethereum Transfers ≥ {data?.whaleThresholdEth ?? '—'} ETH
        <button className="btn btn-ghost" onClick={load} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>
      {loading ? <div className="spinner" /> : error ? (
        <div className="empty" style={{ padding: 30 }}>⚠ {error}</div>
      ) : !data?.whaleTransactions?.length ? (
        <div className="empty" style={{ padding: 30 }}>No ETH transfers ≥ {data?.whaleThresholdEth} ETH in the last {data?.blocksScanned} blocks (~{Math.round((data?.blocksScanned || 0) * 12 / 60)} min). Genuinely quiet window, not an error.</div>
      ) : (
        <table>
          <thead><tr><th style={{ textAlign: 'left' }}>Tx Hash</th><th style={{ textAlign: 'left' }}>From</th><th style={{ textAlign: 'left' }}>To</th><th>Amount</th></tr></thead>
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
  )
}

// ─── DCA Planner ─────────────────────────────────────────────────────────────
export function DCAPlanner() {
  const { coins, dcaPlans, saveDcaPlans, storageBackups, backupToZeroG } = useCryptoStore()
  const [coin, setCoin] = useState('bitcoin')
  const [amount, setAmount] = useState(100)
  const [freq, setFreq] = useState('weekly')
  const [months, setMonths] = useState(12)
  const [result, setResult] = useState(null)

  const calculate = () => {
    const liveCoin = coins.find(c => c.id === coin)
    if (!liveCoin) return
    const periods = freq === 'daily' ? months * 30 : freq === 'weekly' ? months * 4 : months
    const totalInvested = amount * periods
    const avgPrice = liveCoin.current_price * 0.85 // assume bought at 85% of current avg
    const coinsAcquired = totalInvested / avgPrice
    const currentValue = coinsAcquired * liveCoin.current_price
    const pnl = currentValue - totalInvested
    setResult({ totalInvested, coinsAcquired, currentValue, pnl, pnlPct: (pnl / totalInvested) * 100, coin: liveCoin })
  }

  const savePlan = () => {
    if (!result) return
    const plan = { id: Date.now(), coin, amount, freq, months, result, createdAt: new Date().toISOString() }
    saveDcaPlans([plan, ...dcaPlans].slice(0, 50))
  }

  const backup = () => backupToZeroG('dca', dcaPlans)
  const dcaBackup = storageBackups?.dca

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div className="card card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>COIN</div>
            <select value={coin} onChange={e => setCoin(e.target.value)} style={{ width: '100%' }}>
              {coins.slice(0, 50).map(c => <option key={c.id} value={c.id}>{c.symbol.toUpperCase()} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>AMOUNT PER PERIOD ($)</div>
            <input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>FREQUENCY</div>
            <select value={freq} onChange={e => setFreq(e.target.value)} style={{ width: '100%' }}>
              {['daily', 'weekly', 'monthly'].map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>DURATION (MONTHS)</div>
            <input type="number" value={months} onChange={e => setMonths(parseInt(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
        <button className="btn btn-gold" onClick={calculate} style={{ marginTop: 12 }}>Calculate DCA</button>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {[
            ['Total Invested', fmt.large(result.totalInvested), ''],
            ['Coins Acquired', result.coinsAcquired.toFixed(6), 'gold'],
            ['Current Value', fmt.large(result.currentValue), 'gold'],
            ['P&L', (result.pnl >= 0 ? '+' : '') + fmt.large(Math.abs(result.pnl)), result.pnl >= 0 ? 'up' : 'dn'],
            ['Return', (result.pnlPct >= 0 ? '+' : '') + result.pnlPct.toFixed(1) + '%', result.pnlPct >= 0 ? 'up' : 'dn'],
          ].map(([lbl, val, cls]) => (
            <div key={lbl} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: 'var(--text3)', marginBottom: 4 }}>{lbl}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }} className={cls}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={savePlan}>Save Plan</button>
          <button className="btn btn-ghost" onClick={backup} disabled={!dcaPlans.length || dcaBackup?.status === 'pending'}>
            {dcaBackup?.status === 'pending' ? 'Backing up…' : 'Backup to 0G Storage'}
          </button>
          {dcaBackup?.status === 'confirmed' && (
            <a href={dcaBackup.explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--gold)' }}>
              ✅ Stored on 0G — root {dcaBackup.rootHash.slice(0, 10)}…
            </a>
          )}
          {dcaBackup?.status === 'failed' && (
            <span style={{ fontSize: 10, color: 'var(--danger, #ff4d4d)' }}>⚠️ Backup failed: {dcaBackup.error}</span>
          )}
        </div>
      )}

      {dcaPlans.length > 0 && (
        <div className="card card-body">
          <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8 }}>SAVED PLANS ({dcaPlans.length})</div>
          <table>
            <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Amount</th><th>Freq</th><th>Months</th><th>Saved</th></tr></thead>
            <tbody>
              {dcaPlans.slice(0, 10).map(p => (
                <tr key={p.id}>
                  <td>{p.coin}</td>
                  <td className="mono">${p.amount}</td>
                  <td>{p.freq}</td>
                  <td>{p.months}</td>
                  <td style={{ fontSize: 9, color: 'var(--text3)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Position Sizer ──────────────────────────────────────────────────────────
export function PositionSizer() {
  const [capital, setCapital] = useState(10000)
  const [risk, setRisk] = useState(1)
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [result, setResult] = useState(null)

  const calculate = () => {
    const riskAmt = capital * (risk / 100)
    const stopDist = Math.abs(parseFloat(entry) - parseFloat(stop))
    const stopPct = (stopDist / parseFloat(entry)) * 100
    const positionSize = riskAmt / stopDist
    const positionValue = positionSize * parseFloat(entry)
    const leverage = positionValue / capital
    setResult({ riskAmt, stopDist, stopPct, positionSize, positionValue, leverage })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            ['ACCOUNT SIZE ($)', capital, setCapital],
            ['RISK % PER TRADE', risk, setRisk],
            ['ENTRY PRICE ($)', entry, setEntry],
            ['STOP LOSS ($)', stop, setStop],
          ].map(([lbl, val, set]) => (
            <div key={lbl}>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>{lbl}</div>
              <input type="number" value={val} onChange={e => set(e.target.value)} style={{ width: '100%' }} placeholder="0" />
            </div>
          ))}
        </div>
        <button className="btn btn-gold" onClick={calculate} style={{ marginTop: 12 }}>Calculate Position</button>
      </div>
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            ['Risk Amount', '$' + result.riskAmt.toFixed(2), 'dn'],
            ['Stop Distance', result.stopPct.toFixed(2) + '%', 'dn'],
            ['Position Size (coins)', result.positionSize.toFixed(4), 'gold'],
            ['Position Value', '$' + result.positionValue.toFixed(2), 'gold'],
            ['Effective Leverage', result.leverage.toFixed(2) + 'x', result.leverage > 3 ? 'dn' : 'up'],
            ['Max Loss', '$' + result.riskAmt.toFixed(2), 'dn'],
          ].map(([lbl, val, cls]) => (
            <div key={lbl} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: 'var(--text3)', marginBottom: 4 }}>{lbl}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }} className={cls}>{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Smart Alerts ────────────────────────────────────────────────────────────
export function SmartAlerts() {
  const { coins, alerts, saveAlerts } = useCryptoStore()
  const [coin, setCoin] = useState('bitcoin')
  const [condition, setCondition] = useState('above')
  const [price, setPrice] = useState('')

  const addAlert = () => {
    if (!price) return
    const liveCoin = coins.find(c => c.id === coin)
    saveAlerts([...alerts, { id: Date.now(), coin, symbol: liveCoin?.symbol.toUpperCase(), condition, price: parseFloat(price), triggered: false }])
    setPrice('')
  }

  const remove = (id) => saveAlerts(alerts.filter(a => a.id !== id))

  // Check alerts
  useEffect(() => {
    if (!coins.length) return
    const updated = alerts.map(a => {
      const live = coins.find(c => c.id === a.coin)
      if (!live || a.triggered) return a
      const hit = a.condition === 'above' ? live.current_price >= a.price : live.current_price <= a.price
      if (hit) { alert(`🔔 Alert triggered! ${a.symbol} is ${a.condition} $${a.price}`); return { ...a, triggered: true } }
      return a
    })
    saveAlerts(updated)
  }, [coins])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div className="card card-body">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>COIN</div>
            <select value={coin} onChange={e => setCoin(e.target.value)}>
              {coins.slice(0, 50).map(c => <option key={c.id} value={c.id}>{c.symbol.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>CONDITION</div>
            <select value={condition} onChange={e => setCondition(e.target.value)}>
              <option value="above">Price goes above</option>
              <option value="below">Price goes below</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>TARGET PRICE ($)</div>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" style={{ width: 120 }} />
          </div>
          <button className="btn btn-gold" onClick={addAlert}>+ Add Alert</button>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        <div className="card-hd"><div className="dot" style={{ background: 'var(--gold)' }} />Active Alerts ({alerts.filter(a => !a.triggered).length})</div>
        <table>
          <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Condition</th><th>Target</th><th>Current</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {alerts.map(a => {
              const live = coins.find(c => c.id === a.coin)
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 700 }}>{a.symbol}</td>
                  <td style={{ color: 'var(--text2)' }}>Price {a.condition}</td>
                  <td className="mono gold">{fmt.price(a.price)}</td>
                  <td className="mono">{live ? fmt.price(live.current_price) : '—'}</td>
                  <td><span className={`badge ${a.triggered ? 'badge-green' : 'badge-gold'}`}>{a.triggered ? 'TRIGGERED' : 'ACTIVE'}</span></td>
                  <td><button onClick={() => remove(a.id)} style={{ color: 'var(--red)', opacity: .6 }}>✕</button></td>
                </tr>
              )
            })}
            {!alerts.length && <tr><td colSpan={6} className="empty">No alerts set</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Calculator ──────────────────────────────────────────────────────────────
export function Calculator() {
  const { coins } = useCryptoStore()
  const [fromCoin, setFromCoin] = useState('bitcoin')
  const [toCoin, setToCoin] = useState('ethereum')
  const [amount, setAmount] = useState(1)

  const from = coins.find(c => c.id === fromCoin)
  const to = coins.find(c => c.id === toCoin)
  const result = from && to ? (amount * from.current_price) / to.current_price : null

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 20 }}>
      <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>🧮 Crypto Converter</div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>FROM</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} style={{ width: 120 }} />
            <select value={fromCoin} onChange={e => setFromCoin(e.target.value)} style={{ flex: 1 }}>
              {coins.slice(0, 100).map(c => <option key={c.id} value={c.id}>{c.symbol.toUpperCase()} — {c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 20 }}>⇅</div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>TO</div>
          <select value={toCoin} onChange={e => setToCoin(e.target.value)} style={{ width: '100%' }}>
            {coins.slice(0, 100).map(c => <option key={c.id} value={c.id}>{c.symbol.toUpperCase()} — {c.name}</option>)}
          </select>
        </div>
        {result !== null && (
          <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{amount} {from?.symbol.toUpperCase()} =</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>{result.toFixed(6)} {to?.symbol.toUpperCase()}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
              1 {from?.symbol.toUpperCase()} = {fmt.price(from?.current_price)} · 1 {to?.symbol.toUpperCase()} = {fmt.price(to?.current_price)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Journal ─────────────────────────────────────────────────────────────────
export function Journal() {
  const { journal, addTrade, storageBackups, backupToZeroG, walletAddress, walletConnecting, connectOnchainWallet } = useCryptoStore()
  const [form, setForm] = useState({ coin: '', side: 'buy', amount: '', price: '', notes: '' })

  const submit = () => {
    if (!form.coin || !form.amount || !form.price) return
    addTrade({ coin: form.coin.toUpperCase(), side: form.side, amount: parseFloat(form.amount), price: parseFloat(form.price), total: parseFloat(form.amount) * parseFloat(form.price), notes: form.notes, date: new Date().toISOString(), status: 'manual' })
    setForm({ coin: '', side: 'buy', amount: '', price: '', notes: '' })
  }

  const backup = () => backupToZeroG('journal', journal)
  const journalBackup = storageBackups?.journal

  const totalPnl = journal.reduce((s, t) => s + (t.side === 'sell' ? t.total : -t.total), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          ['TOTAL TRADES', journal.length, ''],
          ['NET P&L', (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2), totalPnl >= 0 ? 'up' : 'dn'],
          ['WIN RATE', journal.length ? (journal.filter(t => t.side === 'sell' && t.total > 0).length / journal.filter(t => t.side === 'sell').length * 100 || 0).toFixed(0) + '%' : '—', 'up'],
        ].map(([lbl, val, cls]) => (
          <div key={lbl} className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--text3)', marginBottom: 4 }}>{lbl}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }} className={cls}>{val}</div>
          </div>
        ))}
      </div>

      <div className="card card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {walletAddress ? (
          <span style={{ fontSize: 9, color: 'var(--text3)' }}>🟢 0G: {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
        ) : (
          <button className="btn btn-ghost" disabled={walletConnecting} onClick={connectOnchainWallet}>
            {walletConnecting ? 'Connecting…' : 'Connect 0G Wallet'}
          </button>
        )}
        <button className="btn btn-ghost" disabled={!journal.length || journalBackup?.status === 'pending'} onClick={backup}>
          {journalBackup?.status === 'pending' ? 'Backing up…' : 'Backup Journal to 0G Storage'}
        </button>
        {journalBackup?.status === 'confirmed' && (
          <a href={journalBackup.explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--gold)' }}>
            ✅ Stored on 0G — root {journalBackup.rootHash.slice(0, 10)}…
          </a>
        )}
        {journalBackup?.status === 'failed' && (
          <span style={{ fontSize: 10, color: 'var(--danger, #ff4d4d)' }}>⚠️ Backup failed: {journalBackup.error}</span>
        )}
      </div>

      <div className="card card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[['Coin', 'coin', 'text'], ['Amount', 'amount', 'number'], ['Price ($)', 'price', 'number'], ['Notes', 'notes', 'text']].map(([lbl, key, type]) => (
          <div key={key}>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>{lbl}</div>
            <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={lbl} />
          </div>
        ))}
        <select value={form.side} onChange={e => setForm(f => ({ ...f, side: e.target.value }))}>
          <option value="buy">BUY</option>
          <option value="sell">SELL</option>
        </select>
        <button className="btn btn-gold" onClick={submit}>+ Log Trade</button>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        <table>
          <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Side</th><th>Amount</th><th>Price</th><th>Total</th><th>Notes</th><th>Date</th><th>0G</th></tr></thead>
          <tbody>
            {journal.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 700 }}>{t.coin}</td>
                <td><span className={`badge ${t.side === 'buy' ? 'badge-green' : 'badge-red'}`}>{t.side.toUpperCase()}</span></td>
                <td className="mono">{t.amount}</td>
                <td className="mono">{fmt.price(t.price)}</td>
                <td className="mono gold">{fmt.price(t.total)}</td>
                <td style={{ fontSize: 10, color: 'var(--text2)' }}>{t.notes || '—'}</td>
                <td style={{ fontSize: 9, color: 'var(--text3)' }}>{new Date(t.date).toLocaleDateString()}</td>
                <td style={{ fontSize: 9 }}>
                  {t.onchainStatus === 'confirmed' && <a href={t.explorerUrl} target="_blank" rel="noreferrer" title="View on 0G Explorer">✅</a>}
                  {t.onchainStatus === 'pending' && <span title="Confirming on 0G Chain…">⏳</span>}
                  {t.onchainStatus === 'failed' && <span title="Onchain sync failed">⚠️</span>}
                  {(!t.onchainStatus || t.onchainStatus === 'off') && <span style={{ color: 'var(--text3)' }} title="Not synced onchain">—</span>}
                </td>
              </tr>
            ))}
            {!journal.length && <tr><td colSpan={8} className="empty">No trades logged yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Placeholder ─────────────────────────────────────────────────────────────
export function Placeholder({ name }) {
  return (
    <div className="empty" style={{ paddingTop: 80 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Coming soon — this panel is being built out</div>
    </div>
  )
}
