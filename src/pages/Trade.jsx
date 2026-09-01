import { useState, useEffect, useRef, useMemo } from 'react'
import { useCryptoStore } from '../store/cryptoStore'
import { fmt, pctClass, fetchJson, GECKO } from '../utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const RANGES = ['1H', '4H', '1D', '1W', '1M']
const MARKET_TABS = ['All', 'Gainers', 'Losers', 'Top Volume', 'Watchlist']

export default function Trade() {
  const { coins, fetchCoins, selectedCoin, setSelectedCoin, watchlist, toggleWatchlist, addTrade, journal, walletAddress, walletConnecting, walletError, connectOnchainWallet } = useCryptoStore()
  const [marketTab, setMarketTab] = useState('All')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('1D')
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [orderType, setOrderType] = useState('market')
  const [side, setSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] })
  const [bottomTab, setBottomTab] = useState('Balances')
  const [balances] = useState({ USDT: 10000, BTC: 0.5, ETH: 4.2, SOL: 45 })
  const [stats, setStats] = useState(null)

  useEffect(() => { fetchCoins() }, [])

  useEffect(() => {
    if (coins.length && !selectedCoin) setSelectedCoin(coins[0])
  }, [coins])

  useEffect(() => {
    if (!selectedCoin) return
    loadChart()
    loadStats()
    generateOrderBook()
    setPrice(selectedCoin.current_price?.toFixed(2) || '')
  }, [selectedCoin, range])

  const loadChart = async () => {
    if (!selectedCoin) return
    setChartLoading(true)
    try {
      const days = { '1H': '1', '4H': '1', '1D': '1', '1W': '7', '1M': '30' }[range]
      const d = await fetchJson(`${GECKO}/coins/${selectedCoin.id}/market_chart?vs_currency=usd&days=${days}`)
      setChartData(d.prices.map(([t, p]) => ({ t, p })))
    } catch { setChartData([]) }
    setChartLoading(false)
  }

  const loadStats = async () => {
    try {
      const d = await fetchJson(`${GECKO}/coins/${selectedCoin.id}?localization=false&tickers=false&community_data=false&developer_data=false`)
      setStats(d.market_data)
    } catch { setStats(null) }
  }

  const generateOrderBook = () => {
    if (!selectedCoin) return
    const p = selectedCoin.current_price || 1
    const bids = Array.from({ length: 12 }, (_, i) => ({
      price: p * (1 - (i + 1) * 0.001),
      size: Math.random() * 5 + 0.1,
      total: 0
    }))
    const asks = Array.from({ length: 12 }, (_, i) => ({
      price: p * (1 + (i + 1) * 0.001),
      size: Math.random() * 5 + 0.1,
      total: 0
    }))
    setOrderBook({ bids, asks })
  }

  const filteredCoins = useMemo(() => {
    let list = [...coins]
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase()))
    if (marketTab === 'Gainers') list = list.filter(c => c.price_change_percentage_24h > 0).sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    else if (marketTab === 'Losers') list = list.filter(c => c.price_change_percentage_24h < 0).sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
    else if (marketTab === 'Top Volume') list = list.sort((a, b) => b.total_volume - a.total_volume)
    else if (marketTab === 'Watchlist') list = list.filter(c => watchlist.has(c.id))
    return list
  }, [coins, marketTab, search, watchlist])

  const placeOrder = () => {
    if (!amount || !selectedCoin) return
    const trade = {
      coin: selectedCoin.symbol.toUpperCase(),
      coinId: selectedCoin.id,
      side,
      type: orderType,
      amount: parseFloat(amount),
      price: orderType === 'market' ? selectedCoin.current_price : parseFloat(price),
      total: parseFloat(amount) * (orderType === 'market' ? selectedCoin.current_price : parseFloat(price)),
      date: new Date().toISOString(),
      status: 'filled'
    }
    addTrade(trade)
    setAmount('')
    alert(`✅ ${side.toUpperCase()} order placed!\n${amount} ${selectedCoin.symbol.toUpperCase()} @ ${fmt.price(trade.price)}`)
  }

  const isUp = (selectedCoin?.price_change_percentage_24h || 0) >= 0
  const chartColor = isUp ? '#4dff6e' : '#ff4d4d'

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 10px', fontSize: 11 }}>
        <div className="mono">{fmt.price(payload[0].value)}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 8 }}>
      {/* Left: Coin List */}
      <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11 }} />
        <div style={{ display: 'flex', gap: 2 }}>
          {MARKET_TABS.map(t => (
            <button key={t} onClick={() => setMarketTab(t)}
              style={{ flex: 1, padding: '3px 4px', fontSize: 8, borderRadius: 3, fontWeight: 600,
                background: marketTab === t ? 'rgba(197,160,80,.15)' : 'transparent',
                color: marketTab === t ? 'var(--gold)' : 'var(--text3)', border: 'none' }}>
              {t}
            </button>
          ))}
        </div>
        <div className="card" style={{ flex: 1, overflow: 'auto' }}>
          {filteredCoins.map(c => (
            <div key={c.id} onClick={() => setSelectedCoin(c)}
              style={{
                padding: '7px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: selectedCoin?.id === c.id ? 'rgba(197,160,80,.08)' : 'transparent',
                borderLeft: selectedCoin?.id === c.id ? '2px solid var(--gold)' : '2px solid transparent',
              }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 11 }}>{c.symbol.toUpperCase()}/USDT</div>
                <div style={{ fontSize: 9, color: 'var(--text3)' }}>{c.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 10, fontWeight: 600 }}>{fmt.price(c.current_price)}</div>
                <div style={{ fontSize: 9 }} className={pctClass(c.price_change_percentage_24h)}>
                  {fmt.pct(c.price_change_percentage_24h)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center: Chart + Order Book */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        {/* Header */}
        {selectedCoin && (
          <div className="card" style={{ padding: '8px 14px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={selectedCoin.image} width={24} height={24} style={{ borderRadius: '50%' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedCoin.symbol.toUpperCase()}/USDT</div>
                <div style={{ fontSize: 9, color: 'var(--text3)' }}>{selectedCoin.name}</div>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)' }}>
              {fmt.price(selectedCoin.current_price)}
            </div>
            {[
              ['24h', fmt.pct(selectedCoin.price_change_percentage_24h), pctClass(selectedCoin.price_change_percentage_24h)],
              ['High', fmt.price(selectedCoin.high_24h), 'up'],
              ['Low', fmt.price(selectedCoin.low_24h), 'dn'],
              ['Volume', fmt.large(selectedCoin.total_volume), ''],
              ['Mkt Cap', fmt.large(selectedCoin.market_cap), 'gold'],
            ].map(([lbl, val, cls]) => (
              <div key={lbl}>
                <div style={{ fontSize: 8, color: 'var(--text3)' }}>{lbl}</div>
                <div style={{ fontSize: 11, fontWeight: 600 }} className={cls}>{val}</div>
              </div>
            ))}
            <button onClick={() => toggleWatchlist(selectedCoin.id)} style={{ marginLeft: 'auto', fontSize: 18, color: watchlist.has(selectedCoin.id) ? 'var(--gold)' : 'var(--text3)' }}>
              {watchlist.has(selectedCoin.id) ? '★' : '☆'}
            </button>
          </div>
        )}

        {/* Chart */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            {RANGES.map(r => (
              <button key={r} className={`btn ${range === r ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setRange(r)}>{r}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)' }}>Powered by CoinGecko</span>
          </div>
          <div style={{ flex: 1, padding: '8px 0' }}>
            {chartLoading ? <div className="spinner" /> : chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(197,160,80,.06)" />
                  <XAxis dataKey="t" hide />
                  <YAxis domain={['auto', 'auto']} tickFormatter={v => fmt.price(v)} width={70} tick={{ fontSize: 9, fill: 'rgba(232,224,204,.4)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="p" stroke={chartColor} dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="empty">No chart data</div>}
          </div>
        </div>

        {/* Bottom Tabs */}
        <div className="card" style={{ height: 180 }}>
          <div style={{ display: 'flex', gap: 2, padding: '6px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {['Balances', 'History', 'Analysis'].map(t => (
                <button key={t} className={`btn ${bottomTab === t ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setBottomTab(t)}>{t}</button>
              ))}
            </div>
            {walletAddress ? (
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>
                🟢 0G: {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </span>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: 9 }} disabled={walletConnecting} onClick={connectOnchainWallet}>
                {walletConnecting ? 'Connecting…' : 'Connect 0G Wallet'}
              </button>
            )}
          </div>
          {walletError && <div style={{ fontSize: 9, color: 'var(--danger, #ff4d4d)', padding: '2px 12px' }}>{walletError}</div>}
          <div style={{ overflow: 'auto', height: 130, padding: '8px 12px' }}>
            {bottomTab === 'Balances' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {Object.entries(balances).map(([sym, amt]) => (
                  <div key={sym} style={{ background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{sym}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{amt}</div>
                  </div>
                ))}
              </div>
            )}
            {bottomTab === 'History' && (
              <table>
                <thead><tr><th style={{ textAlign: 'left' }}>Coin</th><th>Side</th><th>Amount</th><th>Price</th><th>Total</th><th>Date</th><th>0G</th></tr></thead>
                <tbody>
                  {journal.slice(0, 20).map(t => (
                    <tr key={t.id}>
                      <td>{t.coin}</td>
                      <td className={t.side === 'buy' ? 'up' : 'dn'}>{t.side.toUpperCase()}</td>
                      <td>{t.amount}</td>
                      <td className="mono">{fmt.price(t.price)}</td>
                      <td className="mono">{fmt.price(t.total)}</td>
                      <td style={{ fontSize: 9, color: 'var(--text3)' }}>{new Date(t.date).toLocaleDateString()}</td>
                      <td style={{ fontSize: 9 }}>
                        {t.onchainStatus === 'confirmed' && <a href={t.explorerUrl} target="_blank" rel="noreferrer" title="View on 0G Explorer">✅</a>}
                        {t.onchainStatus === 'pending' && <span title="Confirming on 0G Chain…">⏳</span>}
                        {t.onchainStatus === 'failed' && <span title="Onchain sync failed">⚠️</span>}
                        {(!t.onchainStatus || t.onchainStatus === 'off') && <span style={{ color: 'var(--text3)' }} title="Not synced onchain">—</span>}
                      </td>
                    </tr>
                  ))}
                  {!journal.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>No trades yet</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Right: Order Book + Trade Panel */}
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {/* Order Book */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="card-hd"><div className="dot" style={{ background: 'var(--gold)' }} />Order Book</div>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ fontSize: 10 }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Price</th><th>Size</th></tr></thead>
              <tbody>
                {orderBook.asks.slice().reverse().map((a, i) => (
                  <tr key={'a' + i}><td className="mono dn">{fmt.price(a.price)}</td><td style={{ color: 'var(--text2)' }}>{a.size.toFixed(4)}</td></tr>
                ))}
                <tr><td colSpan={2} style={{ textAlign: 'center', padding: '4px 0', fontWeight: 700, color: isUp ? 'var(--green)' : 'var(--red)', fontSize: 12 }} className="mono">{fmt.price(selectedCoin?.current_price)}</td></tr>
                {orderBook.bids.map((b, i) => (
                  <tr key={'b' + i}><td className="mono up">{fmt.price(b.price)}</td><td style={{ color: 'var(--text2)' }}>{b.size.toFixed(4)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trade Panel */}
        <div className="card" style={{ flexShrink: 0 }}>
          <div className="card-hd"><div className="dot" style={{ background: 'var(--gold)' }} />Place Order</div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Buy/Sell Toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <button className={`btn ${side === 'buy' ? 'btn-green' : 'btn-ghost'}`} onClick={() => setSide('buy')}>BUY</button>
              <button className={`btn ${side === 'sell' ? 'btn-red' : 'btn-ghost'}`} onClick={() => setSide('sell')}>SELL</button>
            </div>
            {/* Order Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {['market', 'limit'].map(t => (
                <button key={t} className={`btn ${orderType === t ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setOrderType(t)} style={{ fontSize: 10 }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Inputs */}
            {orderType === 'limit' && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>PRICE (USDT)</div>
                <input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" style={{ width: '100%', fontSize: 11 }} />
              </div>
            )}
            <div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>AMOUNT ({selectedCoin?.symbol.toUpperCase()})</div>
              <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', fontSize: 11 }} />
            </div>
            {/* Total */}
            {amount && selectedCoin && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: 'var(--text3)' }}>Total</span>
                <span className="mono gold">{fmt.price(parseFloat(amount) * (orderType === 'market' ? selectedCoin.current_price : parseFloat(price) || 0))}</span>
              </div>
            )}
            <button className={`btn ${side === 'buy' ? 'btn-green' : 'btn-red'}`} onClick={placeOrder} style={{ width: '100%', padding: 9, fontWeight: 700, fontSize: 12 }}>
              {side === 'buy' ? '▲ BUY' : '▼ SELL'} {selectedCoin?.symbol.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
