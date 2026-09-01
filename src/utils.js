export const fmt = {
  price: (p) => {
    if (!p && p !== 0) return '—'
    if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 })
    if (p >= 1) return '$' + p.toFixed(2)
    if (p >= 0.01) return '$' + p.toFixed(4)
    return '$' + p.toFixed(6)
  },
  pct: (p, decimals = 2) => {
    if (p == null) return '—'
    const sign = p >= 0 ? '▲' : '▼'
    return `${sign}${Math.abs(p).toFixed(decimals)}%`
  },
  large: (v) => {
    if (!v) return '—'
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'
    return '$' + v.toLocaleString()
  },
  num: (v) => {
    if (!v && v !== 0) return '—'
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
    return v.toFixed(2)
  },
  time: (ms) => {
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 60) return s + 's ago'
    if (s < 3600) return Math.floor(s / 60) + 'm ago'
    if (s < 86400) return Math.floor(s / 3600) + 'h ago'
    return Math.floor(s / 86400) + 'd ago'
  }
}

export const pctClass = (v) => v == null ? '' : v >= 0 ? 'up' : 'dn'

export const GECKO = 'https://api.coingecko.com/api/v3'
export const ALT_ME = 'https://api.alternative.me'

export async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function useAutoRefresh(fn, ms = 60000) {
  // called in components via useEffect — just a helper note
}
