import { useEffect } from 'react'
import { useCryptoStore } from './store/cryptoStore'
import { NAV } from './nav'
import { fmt, pctClass } from './utils'

import Market from './pages/Market'
import Heatmap from './pages/Heatmap'
import Screener from './pages/Screener'
import Trade from './pages/Trade'
import Vault from './pages/Vault'
import { News, Sentiment, WhaleTracker, DCAPlanner, PositionSizer, SmartAlerts, Calculator, Journal, Placeholder } from './pages/OtherPages'
import { PriceTicker, MultiChart, CorrelationMatrix, BreakoutScanner } from './pages/AnalysisPages'
import { FundingRates, DeFiYield, DepegMonitor, ArbitrageScanner } from './pages/DataFeedPages'
import { Backtester, GlobalMacro } from './pages/BacktestPages'
import { NFTPulse } from './pages/NFTPulse'
import { BTCEtfs } from './pages/BTCEtfs'
import { AISignals, InstitutionalFlow, LiquidationHeatmap } from './pages/IntelPages'
import { OnChainIntel } from './pages/OnChainIntel'

const PAGES = {
  market: <Market />,
  heatmap: <Heatmap />,
  screener: <Screener />,
  trade: <Trade />,
  vault: <Vault />,
  news: <News />,
  sentiment: <Sentiment />,
  whale: <WhaleTracker />,
  dca: <DCAPlanner />,
  positionsizer: <PositionSizer />,
  smartalerts: <SmartAlerts />,
  calculator: <Calculator />,
  journal: <Journal />,
  ticker: <PriceTicker />,
  multichart: <MultiChart />,
  breakout: <BreakoutScanner />,
  funding: <FundingRates />,
  liqmap: <LiquidationHeatmap />,
  backtester: <Backtester />,
  ai: <AISignals />,
  onchain: <OnChainIntel />,
  macro: <GlobalMacro />,
  correlation: <CorrelationMatrix />,
  inst: <InstitutionalFlow />,
  etf: <BTCEtfs />,
  defiyield: <DeFiYield />,
  nftpulse: <NFTPulse />,
  depeg: <DepegMonitor />,
  arbitrage: <ArbitrageScanner />,
  regulatory: <Placeholder name="Regulatory Intel" />,
  events: <Placeholder name="Events Calendar" />,
}

export default function App() {
  const { activePage, setActivePage, coins, fetchCoins, fetchGlobal, connectLiveFeed, disconnectLiveFeed, liveFeedConnected } = useCryptoStore()

  useEffect(() => {
    fetchCoins()
    fetchGlobal()
    // Live tick-by-tick prices via websocket (Binance, free, no key) —
    // covers any coin with a *USDT pair. The 60s REST poll below still
    // runs, to keep metadata (rank, images, coins with no Binance pair)
    // fresh, but price/24h% for Binance-listed coins is now driven by the
    // live feed instead of waiting up to 60s.
    connectLiveFeed()
    const interval = setInterval(() => fetchCoins(true), 60000)
    return () => { clearInterval(interval); disconnectLiveFeed() }
  }, [])

  // Listen for navigation from parent OnyxLock app-shell
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'onyxCryptoNav' && e.data.page) setActivePage(e.data.page)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const btc = coins.find(c => c.id === 'bitcoin')
  const eth = coins.find(c => c.id === 'ethereum')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Bar */}
      <div style={{
        height: 40, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)', letterSpacing: '.5px' }}>
          🔐 ONYX CRYPTO
        </div>
        {btc && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>BTC</span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{fmt.price(btc.current_price)}</span>
            <span style={{ fontSize: 10 }} className={pctClass(btc.price_change_percentage_24h)}>{fmt.pct(btc.price_change_percentage_24h)}</span>
          </div>
        )}
        {eth && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>ETH</span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{fmt.price(eth.current_price)}</span>
            <span style={{ fontSize: 10 }} className={pctClass(eth.price_change_percentage_24h)}>{fmt.pct(eth.price_change_percentage_24h)}</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: liveFeedConnected ? 'var(--green)' : 'var(--red)', display: 'inline-block' }} />
          {liveFeedConnected ? 'Live' : 'Reconnecting…'} · {coins.length} coins
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 'var(--sidebar-w)', background: 'var(--bg2)', borderRight: '1px solid var(--border)',
          overflow: 'auto', flexShrink: 0
        }}>
          {NAV.map(section => (
            <div key={section.title}>
              <div style={{
                fontSize: 8, fontWeight: 700, letterSpacing: '.8px', color: 'var(--text3)',
                padding: '12px 14px 4px', marginTop: 4
              }}>{section.title}</div>
              {section.items.map(item => (
                <button key={item.id} onClick={() => setActivePage(item.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '7px 14px',
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 8,
                    background: activePage === item.id ? 'rgba(197,160,80,.08)' : 'transparent',
                    borderLeft: activePage === item.id ? '2px solid var(--gold)' : '2px solid transparent',
                    color: activePage === item.id ? 'var(--text)' : 'var(--text2)',
                    transition: 'all .1s',
                  }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color, flexShrink: 0, opacity: activePage === item.id ? 1 : 0.4 }} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {PAGES[activePage] || <Placeholder name={activePage} />}
        </div>
      </div>
    </div>
  )
}
