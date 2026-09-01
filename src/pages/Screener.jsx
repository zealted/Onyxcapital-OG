import { useState, useEffect, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass } from '../utils'

const FILTERS = {
  priceChange24h: { label: '24h Change', options: ['Any', '>5%', '>10%', '<-5%', '<-10%'] },
  marketCap: { label: 'Market Cap', options: ['Any', '>$1B', '>$100M', '<$100M'] },
  volume: { label: 'Volume', options: ['Any', '>$1B', '>$100M', '<$10M'] },
  ath_change: { label: 'From ATH', options: ['Any', '<-50%', '<-75%', '<-90%'] },
}

export default function Screener() {
  const { coins, fetchCoins } = useCryptoStore()
  const [filters, setFilters] = useState({ priceChange24h: 'Any', marketCap: 'Any', volume: 'Any', ath_change: 'Any' })
  const [sort, setSort] = useState({ col: 'market_cap_rank', dir: 1 })

  useEffect(() => { fetchCoins() }, [])

  const results = useMemo(() => {
    let list = [...coins]

    // Apply filters
    const { priceChange24h, marketCap, volume, ath_change } = filters
    if (priceChange24h === '>5%') list = list.filter(c => c.price_change_percentage_24h > 5)
    else if (priceChange24h === '>10%') list = list.filter(c => c.price_change_percentage_24h > 10)
    else if (priceChange24h === '<-5%') list = list.filter(c => c.price_change_percentage_24h < -5)
    else if (priceChange24h === '<-10%') list = list.filter(c => c.price_change_percentage_24h < -10)

    if (marketCap === '>$1B') list = list.filter(c => c.market_cap > 1e9)
    else if (marketCap === '>$100M') list = list.filter(c => c.market_cap > 1e8)
    else if (marketCap === '<$100M') list = list.filter(c => c.market_cap < 1e8)

    if (volume === '>$1B') list = list.filter(c => c.total_volume > 1e9)
    else if (volume === '>$100M') list = list.filter(c => c.total_volume > 1e8)
    else if (volume === '<$10M') list = list.filter(c => c.total_volume < 1e7)

    if (ath_change === '<-50%') list = list.filter(c => c.ath_change_percentage < -50)
    else if (ath_change === '<-75%') list = list.filter(c => c.ath_change_percentage < -75)
    else if (ath_change === '<-90%') list = list.filter(c => c.ath_change_percentage < -90)

    // Sort
    list.sort((a, b) => ((a[sort.col] ?? 0) - (b[sort.col] ?? 0)) * sort.dir)
    return list
  }, [coins, filters, sort])

  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: -s.dir } : { col, dir: 1 })
  const si = (col) => sort.col === col ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Filter Bar */}
      <div className="card card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 14px' }}>
        {Object.entries(FILTERS).map(([key, { label, options }]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--text3)', letterSpacing: '.5px' }}>{label.toUpperCase()}</span>
            <select value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} style={{ fontSize: 11, padding: '4px 8px' }}>
              {options.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text2)', alignSelf: 'center' }}>{results.length} results</span>
          <button className="btn btn-ghost" onClick={() => setFilters({ priceChange24h: 'Any', marketCap: 'Any', volume: 'Any', ath_change: 'Any' })}>Reset</button>
          <button className="btn btn-gold" onClick={() => fetchCoins(true)}>↻ Refresh</button>
        </div>
      </div>

      {/* Results Table */}
      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        {!coins.length ? <div className="spinner" /> : (
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }} onClick={() => toggleSort('market_cap_rank')}>#</th>
                <th style={{ textAlign: 'left' }}>Coin</th>
                <th onClick={() => toggleSort('current_price')}>Price{si('current_price')}</th>
                <th onClick={() => toggleSort('price_change_percentage_24h')}>24h{si('price_change_percentage_24h')}</th>
                <th onClick={() => toggleSort('price_change_percentage_7d_in_currency')}>7d{si('price_change_percentage_7d_in_currency')}</th>
                <th onClick={() => toggleSort('market_cap')}>Mkt Cap{si('market_cap')}</th>
                <th onClick={() => toggleSort('total_volume')}>Volume{si('total_volume')}</th>
                <th onClick={() => toggleSort('ath_change_percentage')}>From ATH{si('ath_change_percentage')}</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 100).map(c => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text3)', fontSize: 10 }}>{c.market_cap_rank}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <img src={c.image} width={16} height={16} style={{ borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 11 }}>{c.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text3)' }}>{c.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{fmt.price(c.current_price)}</td>
                  <td className={pctClass(c.price_change_percentage_24h)}>{fmt.pct(c.price_change_percentage_24h)}</td>
                  <td className={pctClass(c.price_change_percentage_7d_in_currency)}>{fmt.pct(c.price_change_percentage_7d_in_currency)}</td>
                  <td style={{ color: 'var(--text2)' }}>{fmt.large(c.market_cap)}</td>
                  <td style={{ color: 'var(--text2)' }}>{fmt.large(c.total_volume)}</td>
                  <td className={pctClass(c.ath_change_percentage)}>{fmt.pct(c.ath_change_percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
