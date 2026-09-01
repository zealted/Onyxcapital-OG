import { create } from 'zustand'
import { connectWallet, logTradeOnChain } from '../lib/onchain'
import { uploadToZeroGStorage } from '../lib/zerogStorage'

const CACHE_TTL = 60_000 // 1 min

// ── Live price feed (Binance public websocket, free, no key) ───────────────
// !ticker@arr (the old "all market tickers" stream) was deprecated by
// Binance on 2025-11-14 — using !miniTicker@arr instead, which is still
// active. It has no direct 24h % field, so that's computed here from
// open/close. This only covers coins that have a *USDT pair on Binance;
// everything else keeps using the 60s CoinGecko REST price as before.
let ws = null
let wsReconnectDelay = 1000
let wsPendingPatch = {}
let wsFlushTimer = null

export const useCryptoStore = create((set, get) => ({
  // ── Coin data ──────────────────────────────────────────────
  coins: [],
  coinsLoadedAt: 0,
  coinsLoading: false,
  coinsError: null,

  // ── Live feed status ────────────────────────────────────────
  liveFeedConnected: false,

  // ── Global market ──────────────────────────────────────────
  global: null,
  globalLoadedAt: 0,

  // ── Selected coin (for LetsTrade) ─────────────────────────
  selectedCoin: null,
  setSelectedCoin: (coin) => set({ selectedCoin: coin }),

  // ── Active page ────────────────────────────────────────────
  activePage: 'market',
  setActivePage: (page) => set({ activePage: page }),

  // ── Active market tab (LetsTrade) ─────────────────────────
  marketTab: 'All',
  setMarketTab: (tab) => set({ marketTab: tab }),

  // ── Watchlist ─────────────────────────────────────────────
  watchlist: new Set(JSON.parse(localStorage.getItem('onyx:watchlist') || '[]')),
  toggleWatchlist: (id) => {
    const wl = new Set(get().watchlist)
    wl.has(id) ? wl.delete(id) : wl.add(id)
    localStorage.setItem('onyx:watchlist', JSON.stringify([...wl]))
    set({ watchlist: wl })
  },

  // ── Fetch coins (cached) ───────────────────────────────────
  fetchCoins: async (force = false) => {
    const { coins, coinsLoadedAt, coinsLoading } = get()
    if (coinsLoading) return coins
    if (!force && coins.length && Date.now() - coinsLoadedAt < CACHE_TTL) return coins

    set({ coinsLoading: true, coinsError: null })
    try {
      const base = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&sparkline=true&price_change_percentage=7d'
      const [p1, p2] = await Promise.all([
        fetch(base + '&page=1').then(r => r.json()),
        fetch(base + '&page=2').then(r => r.json()),
      ])
      const merged = [...p1, ...p2]
      set({ coins: merged, coinsLoadedAt: Date.now(), coinsLoading: false })
      return merged
    } catch (e) {
      set({ coinsError: e.message, coinsLoading: false })
      return []
    }
  },

  // ── Live price feed (Binance websocket) ────────────────────
  // Call once on app mount. Safe to call multiple times — no-ops if a
  // connection already exists. Merges live price/24h-change into the
  // existing `coins` array for any coin with a *USDT pair on Binance.
  connectLiveFeed: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

    const flush = () => {
      const patch = wsPendingPatch
      wsPendingPatch = {}
      wsFlushTimer = null
      if (!Object.keys(patch).length) return
      set(state => ({
        coins: state.coins.map(c => {
          const t = patch[c.symbol.toUpperCase() + 'USDT']
          if (!t) return c
          return { ...c, current_price: t.price, price_change_percentage_24h: t.pct, price_change_percentage_24h_in_currency: t.pct }
        })
      }))
    }

    const connect = () => {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr')

      ws.onopen = () => {
        wsReconnectDelay = 1000
        set({ liveFeedConnected: true })
      }

      ws.onmessage = (event) => {
        let ticks
        try { ticks = JSON.parse(event.data) } catch { return }
        if (!Array.isArray(ticks)) return
        for (const t of ticks) {
          if (!t.s || !t.s.endsWith('USDT')) continue
          const close = parseFloat(t.c)
          const open = parseFloat(t.o)
          if (!Number.isFinite(close) || !Number.isFinite(open) || open === 0) continue
          wsPendingPatch[t.s] = { price: close, pct: ((close - open) / open) * 100 }
        }
        // Batch merges to at most ~1/sec so a burst of messages doesn't
        // trigger a re-render per message.
        if (!wsFlushTimer) wsFlushTimer = setTimeout(flush, 1000)
      }

      ws.onclose = () => {
        set({ liveFeedConnected: false })
        // Reconnect with exponential backoff, capped at 30s, per Binance's
        // own guidance for handling stream disconnects.
        setTimeout(connect, wsReconnectDelay)
        wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000)
      }

      ws.onerror = () => { ws.close() }
    }

    connect()
  },

  disconnectLiveFeed: () => {
    if (wsFlushTimer) { clearTimeout(wsFlushTimer); wsFlushTimer = null }
    if (ws) { ws.onclose = null; ws.close(); ws = null }
    set({ liveFeedConnected: false })
  },

  // ── Fetch global market data (cached) ─────────────────────
  fetchGlobal: async () => {
    const { global, globalLoadedAt } = get()
    if (global && Date.now() - globalLoadedAt < CACHE_TTL) return global
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/global')
      const d = await r.json()
      set({ global: d.data, globalLoadedAt: Date.now() })
      return d.data
    } catch { return null }
  },

  // ── 0G Chain wallet ─────────────────────────────────────────
  walletAddress: null,
  walletConnecting: false,
  walletError: null,
  connectOnchainWallet: async () => {
    set({ walletConnecting: true, walletError: null })
    try {
      const address = await connectWallet()
      set({ walletAddress: address, walletConnecting: false })
      return address
    } catch (e) {
      set({ walletError: e.message, walletConnecting: false })
      return null
    }
  },

  // ── Trade journal (localStorage + 0G Chain) ────────────────
  journal: JSON.parse(localStorage.getItem('onyx:journal') || '[]'),
  addTrade: (trade) => {
    const id = Date.now()
    const entry = { ...trade, id, onchainStatus: get().walletAddress ? 'pending' : 'off' }
    const journal = [entry, ...get().journal].slice(0, 200)
    localStorage.setItem('onyx:journal', JSON.stringify(journal))
    set({ journal })

    // Best-effort onchain sync — never blocks the trading flow.
    if (get().walletAddress) {
      logTradeOnChain(trade)
        .then(({ txHash, explorerUrl }) => {
          const updated = get().journal.map(t => t.id === id ? { ...t, onchainStatus: 'confirmed', txHash, explorerUrl } : t)
          localStorage.setItem('onyx:journal', JSON.stringify(updated))
          set({ journal: updated })
        })
        .catch(() => {
          const updated = get().journal.map(t => t.id === id ? { ...t, onchainStatus: 'failed' } : t)
          localStorage.setItem('onyx:journal', JSON.stringify(updated))
          set({ journal: updated })
        })
    }
  },

  // ── DCA Plans (localStorage) ──────────────────────────────
  dcaPlans: JSON.parse(localStorage.getItem('onyx:dca') || '[]'),
  saveDcaPlans: (plans) => {
    localStorage.setItem('onyx:dca', JSON.stringify(plans))
    set({ dcaPlans: plans })
  },

  // ── 0G Storage backups ──────────────────────────────────────
  // Generic backup status for any blob pushed to 0G Storage this
  // session, keyed by a caller-chosen id (e.g. 'dca', 'journal').
  storageBackups: JSON.parse(localStorage.getItem('onyx:storageBackups') || '{}'),
  backupToZeroG: async (key, data) => {
    set(state => ({ storageBackups: { ...state.storageBackups, [key]: { status: 'pending' } } }))
    try {
      const { rootHash, explorerUrl } = await uploadToZeroGStorage(data, key)
      const backups = { ...get().storageBackups, [key]: { status: 'confirmed', rootHash, explorerUrl, at: Date.now() } }
      localStorage.setItem('onyx:storageBackups', JSON.stringify(backups))
      set({ storageBackups: backups })
      return { rootHash, explorerUrl }
    } catch (e) {
      const backups = { ...get().storageBackups, [key]: { status: 'failed', error: e.message } }
      localStorage.setItem('onyx:storageBackups', JSON.stringify(backups))
      set({ storageBackups: backups })
      return null
    }
  },

  // ── Smart alerts ──────────────────────────────────────────
  alerts: JSON.parse(localStorage.getItem('onyx:alerts') || '[]'),
  saveAlerts: (alerts) => {
    localStorage.setItem('onyx:alerts', JSON.stringify(alerts))
    set({ alerts })
  },
}))
