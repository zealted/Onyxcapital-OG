import { useState, useEffect, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass, fetchJson, GECKO } from '../utils'

const DEFAULT_HOLDINGS = [
  { id: 'bitcoin', symbol: 'BTC', amount: 0, avgPrice: 0 },
  { id: 'ethereum', symbol: 'ETH', amount: 0, avgPrice: 0 },
  { id: 'solana', symbol: 'SOL', amount: 0, avgPrice: 0 },
]

export default function Vault() {
  const { coins, fetchCoins } = useCryptoStore()
  const [holdings, setHoldings] = useState(() => JSON.parse(localStorage.getItem('onyx:vault') || JSON.stringify(DEFAULT_HOLDINGS)))
  const [adding, setAdding] = useState(false)
  const [newCoin, setNewCoin] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newAvg, setNewAvg] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchCoins() }, [])
  useEffect(() => { localStorage.setItem('onyx:vault', JSON.stringify(holdings)) }, [holdings])

  const enriched = useMemo(() => {
    return holdings.map(h => {
      const live = coins.find(c => c.id === h.id || c.symbol.toLowerCase() === h.symbol.toLowerCase())
      const price = live?.current_price || 0
      const value = price * h.amount
      const cost = h.avgPrice * h.amount
      const pnl = value - cost
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
      return { ...h, price, value, pnl, pnlPct, image: live?.image, change24h: live?.price_change_percentage_24h }
    })
  }, [holdings, coins])

  const totalValue = enriched.reduce((s, h) => s + h.value, 0)
  const totalCost = holdings.reduce((s, h) => s + h.avgPrice * h.amount, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  const addHolding = () => {
    const coin = coins.find(c => c.symbol.toLowerCase() === newCoin.toLowerCase() || c.name.toLowerCase() === newCoin.toLowerCase())
    if (!coin) return alert('Coin not found — try the symbol e.g. BTC')
    const existing = holdings.findIndex(h => h.id === coin.id)
    if (existing >= 0) {
      const updated = [...holdings]
      updated[existing] = { ...updated[existing], amount: parseFloat(newAmount) || updated[existing].amount, avgPrice: parseFloat(newAvg) || updated[existing].avgPrice }
      setHoldings(updated)
    } else {
      setHoldings([...holdings, { id: coin.id, symbol: coin.symbol.toUpperCase(), amount: parseFloat(newAmount) || 0, avgPrice: parseFloat(newAvg) || 0 }])
    }
    setNewCoin(''); setNewAmount(''); setNewAvg(''); setAdding(false)
  }

  const remove = (id) => setHoldings(holdings.filter(h => h.id !== id))
  const update = (id, field, val) => setHoldings(holdings.map(h => h.id === id ? { ...h, [field]: parseFloat(val) || 0 } : h))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Portfolio Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          ['TOTAL VALUE', fmt.large(totalValue), 'gold'],
          ['TOTAL COST', fmt.large(totalCost), ''],
          ['TOTAL P&L', (totalPnl >= 0 ? '+' : '') + fmt.large(Math.abs(totalPnl)), totalPnl >= 0 ? 'up' : 'dn'],
          ['P&L %', (totalPnlPct >= 0 ? '+' : '') + totalPnlPct.toFixed(2) + '%', totalPnlPct >= 0 ? 'up' : 'dn'],
        ].map(([lbl, val, cls]) => (
          <div key={lbl} className="card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 8, color: 'var(--text3)', letterSpacing: '.5px', marginBottom: 4 }}>{lbl}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }} className={cls}>{val}</div>
          </div>
        ))}
      </div>

      {/* Holdings Table */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-hd" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="dot" style={{ background: 'var(--gold)' }} />
            HOLDINGS
          </div>
          <button className="btn btn-gold" onClick={() => setAdding(!adding)}>+ Add Coin</button>
        </div>

        {/* Add Form */}
        {adding && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(197,160,80,.03)' }}>
            <input placeholder="Coin symbol (e.g. BTC)" value={newCoin} onChange={e => setNewCoin(e.target.value)} style={{ width: 160 }} />
            <input placeholder="Amount" value={newAmount} onChange={e => setNewAmount(e.target.value)} style={{ width: 100 }} type="number" />
            <input placeholder="Avg buy price ($)" value={newAvg} onChange={e => setNewAvg(e.target.value)} style={{ width: 140 }} type="number" />
            <button className="btn btn-green" onClick={addHolding}>Add</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        )}

        <div style={{ overflow: 'auto', flex: 1 }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Coin</th>
                <th>Price</th>
                <th>24h</th>
                <th>Holdings</th>
                <th>Avg Price</th>
                <th>Value</th>
                <th>P&L</th>
                <th>P&L %</th>
                <th>Allocation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enriched.map(h => (
                <tr key={h.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {h.image && <img src={h.image} width={18} height={18} style={{ borderRadius: '50%' }} />}
                      <div>
                        <div style={{ fontWeight: 700 }}>{h.symbol}</div>
                        <div style={{ fontSize: 9, color: 'var(--text3)' }}>{h.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{fmt.price(h.price)}</td>
                  <td className={pctClass(h.change24h)}>{fmt.pct(h.change24h)}</td>
                  <td>
                    <input type="number" value={h.amount} onChange={e => update(h.id, 'amount', e.target.value)}
                      style={{ width: 80, fontSize: 11, textAlign: 'right', padding: '3px 6px' }} />
                  </td>
                  <td>
                    <input type="number" value={h.avgPrice} onChange={e => update(h.id, 'avgPrice', e.target.value)}
                      style={{ width: 90, fontSize: 11, textAlign: 'right', padding: '3px 6px' }} />
                  </td>
                  <td className="mono gold">{fmt.large(h.value)}</td>
                  <td className={h.pnl >= 0 ? 'up' : 'dn'}>{h.pnl >= 0 ? '+' : ''}{fmt.large(Math.abs(h.pnl))}</td>
                  <td className={h.pnlPct >= 0 ? 'up' : 'dn'}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</td>
                  <td>
                    <div style={{ fontSize: 10, color: 'var(--text2)' }}>{totalValue > 0 ? ((h.value / totalValue) * 100).toFixed(1) + '%' : '—'}</div>
                    <div className="pct-bar" style={{ width: 60 }}>
                      <div className="pct-bar-fill" style={{ width: totalValue > 0 ? (h.value / totalValue) * 100 + '%' : '0%', background: 'var(--gold)' }} />
                    </div>
                  </td>
                  <td><button onClick={() => remove(h.id)} style={{ color: 'var(--red)', fontSize: 14, opacity: .6 }}>✕</button></td>
                </tr>
              ))}
              {!enriched.length && (
                <tr><td colSpan={10} className="empty">No holdings yet — add your first coin above</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
