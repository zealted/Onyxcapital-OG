import { useState, useEffect, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass } from '../utils'

const MARKET_TABS = ['All', 'Gainers', 'Losers', 'Top Volume', 'New Highs', 'New Lows', 'Watchlist']
const SORT_COLS = ['market_cap_rank', 'current_price', 'price_change_percentage_24h', 'price_change_percentage_7d_in_currency', 'market_cap', 'total_volume']

export default function Market() {
  const { coins, coinsLoading, coinsError, fetchCoins, fetchGlobal, global, watchlist, toggleWatchlist } = useCryptoStore()
  const [tab, setTab] = useState('All')
  const [sort, setSort] = useState({ col: 'market_cap_rank', dir: 1 })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  useEffect(() => { fetchCoins(); fetchGlobal() }, [])

  const filtered = useMemo(() => {
    let list = [...coins]
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase()))
    if (tab === 'Gainers') list = list.filter(c => c.price_change_percentage_24h > 0).sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    else if (tab === 'Losers') list = list.filter(c => c.price_change_percentage_24h < 0).sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
    else if (tab === 'Top Volume') list = list.sort((a, b) => b.total_volume - a.total_volume)
    else if (tab === 'New Highs') list = list.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 30)
    else if (tab === 'New Lows') list = list.sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 30)
    else if (tab === 'Watchlist') list = list.filter(c => watchlist.has(c.id))
    else list = list.sort((a, b) => (a[sort.col] - b[sort.col]) * sort.dir)
    return list
  }, [coins, tab, sort, search, watchlist])

  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: -s.dir } : { col, dir: 1 })
  const sortIcon = (col) => sort.col === col ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Global Stats Bar */}
      {global && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['TOTAL MCAP', fmt.large(global.total_market_cap?.usd), 'gold'],
            ['BTC DOM', global.market_cap_percentage?.btc?.toFixed(1) + '%', 'gold'],
            ['ETH DOM', global.market_cap_percentage?.eth?.toFixed(1) + '%', 'cyan'],
            ['24H VOLUME', fmt.large(global.total_volume?.usd), ''],
            ['ACTIVE COINS', global.active_cryptocurrencies?.toLocaleString(), 'green'],
            ['MARKETS', global.markets?.toLocaleString(), ''],
          ].map(([lbl, val, cls]) => (
            <div key={lbl} className="card" style={{ padding: '6px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 8, color: 'var(--text3)', letterSpacing: '.5px' }}>{lbl}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }} className={cls}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + Tabs */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search coins..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{ width: 180 }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {MARKET_TABS.map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-gold' : 'btn-ghost'}`} onClick={() => { setTab(t); setPage(0) }}>
              {t}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => fetchCoins(true)} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div className="card" style={{ flex: 1, overflow: 'auto' }}>
        {coinsLoading && !coins.length ? (
          <div className="spinner" />
        ) : coinsError ? (
          <div className="empty">⚠️ {coinsError}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th style={{ textAlign: 'left' }} onClick={() => toggleSort('name')}>Coin{sortIcon('name')}</th>
                <th onClick={() => toggleSort('current_price')}>Price{sortIcon('current_price')}</th>
                <th onClick={() => toggleSort('price_change_percentage_24h')}>24h{sortIcon('price_change_percentage_24h')}</th>
                <th onClick={() => toggleSort('price_change_percentage_7d_in_currency')}>7d{sortIcon('price_change_percentage_7d_in_currency')}</th>
                <th onClick={() => toggleSort('market_cap')}>Mkt Cap{sortIcon('market_cap')}</th>
                <th onClick={() => toggleSort('total_volume')}>Volume{sortIcon('total_volume')}</th>
                <th>★</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }}>
                  <td style={{ color: 'var(--text3)', fontSize: 10 }}>{c.market_cap_rank}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <img src={c.image} width={18} height={18} style={{ borderRadius: '50%' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{c.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text3)' }}>{c.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{fmt.price(c.current_price)}</td>
                  <td className={pctClass(c.price_change_percentage_24h)}>{fmt.pct(c.price_change_percentage_24h)}</td>
                  <td className={pctClass(c.price_change_percentage_7d_in_currency)}>{fmt.pct(c.price_change_percentage_7d_in_currency)}</td>
                  <td style={{ color: 'var(--text2)' }}>{fmt.large(c.market_cap)}</td>
                  <td style={{ color: 'var(--text2)' }}>{fmt.large(c.total_volume)}</td>
                  <td>
                    <button onClick={e => { e.stopPropagation(); toggleWatchlist(c.id) }}
                      style={{ color: watchlist.has(c.id) ? 'var(--gold)' : 'var(--text3)', fontSize: 14 }}>
                      {watchlist.has(c.id) ? '★' : '☆'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹ Prev</button>
          <span style={{ fontSize: 11, color: 'var(--text2)' }}>Page {page + 1} / {totalPages}</span>
          <button className="btn btn-ghost" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>Next ›</button>
        </div>
      )}
    </div>
  )
}
