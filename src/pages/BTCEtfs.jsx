import { useState, useEffect } from 'react'
import { fmt, pctClass } from '../utils'

const MARKET_API = 'https://onyxlockapi.onrender.com/api/market'

// ─── BTC ETFs ──────────────────────────────────────────────────────────────
// Real US spot Bitcoin ETF flow data via SoSoValue (already configured and
// confirmed working on the backend — no changes needed there). Fields
// confirmed from a live response: totalNetAssets, dailyNetInflow,
// cumNetInflow, totalTotalValueTraded, totalTokenHoldings at the top level,
// and a `list` of per-ETF rows with netAssets, dailyNetInflow, cumNetInflow,
// dailyValueTraded, discountPremiumRate, fee, netAssetsPercentage.
export function BTCEtfs() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${MARKET_API}/etf`)
      if (!r.ok) throw new Error(`Server returned ${r.status}`)
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

  const v = (obj) => obj?.value != null ? Number(obj.value) : null
  const list = data?.list || []
  const sorted = [...list].sort((a, b) => (v(b.netAssets) || 0) - (v(a.netAssets) || 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>US Spot Bitcoin ETFs · Source: SoSoValue · updated {data?.totalNetAssets?.lastUpdateDate}</span>
        <button className="btn btn-ghost" onClick={load} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {loading ? <div className="spinner" /> : error ? (
        <div className="card empty" style={{ padding: 30 }}>⚠ {error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>TOTAL NET ASSETS</div>
              <div className="gold" style={{ fontSize: 20, fontWeight: 700 }}>{fmt.large(v(data?.totalNetAssets))}</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>DAILY NET INFLOW</div>
              <div className={pctClass(v(data?.dailyNetInflow))} style={{ fontSize: 20, fontWeight: 700 }}>{fmt.large(v(data?.dailyNetInflow))}</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>CUMULATIVE INFLOW</div>
              <div className={pctClass(v(data?.cumNetInflow))} style={{ fontSize: 20, fontWeight: 700 }}>{fmt.large(v(data?.cumNetInflow))}</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>BTC HELD (ALL ETFS)</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{v(data?.totalTokenHoldings)?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          <div className="card" style={{ flex: 1, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Ticker</th>
                  <th style={{ textAlign: 'left' }}>Institute</th>
                  <th>Net Assets</th>
                  <th>Daily Inflow</th>
                  <th>Cumulative Inflow</th>
                  <th>Fee</th>
                  <th>Premium/Discount</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 700 }}>{row.ticker}</td>
                    <td style={{ color: 'var(--text2)' }}>{row.institute}</td>
                    <td className="mono gold">{fmt.large(v(row.netAssets))}</td>
                    <td className={pctClass(v(row.dailyNetInflow))}>{fmt.large(v(row.dailyNetInflow))}</td>
                    <td className={pctClass(v(row.cumNetInflow))}>{fmt.large(v(row.cumNetInflow))}</td>
                    <td style={{ color: 'var(--text2)' }}>{(v(row.fee) * 100).toFixed(2)}%</td>
                    <td className={pctClass(v(row.discountPremiumRate))}>{(v(row.discountPremiumRate) * 100).toFixed(3)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
