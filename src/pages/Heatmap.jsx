import { useState, useEffect, useRef } from 'react'
import { useCryptoStore } from '../store/cryptoStore'

// Correct squarified treemap layout (Bruls/Huizing/van Wijk algorithm).
// The previous version reset row height to the full canvas height after
// laying out just the first row, so the single largest coin (BTC) consumed
// the entire chart and nothing else ever got placed. This lays out each
// row along the CURRENT shorter side of the remaining rectangle, building
// each row by adding items only while doing so improves (or doesn't worsen)
// the squareness of the resulting rectangles.
function squarify(coins, W, H) {
  const total = coins.reduce((s, c) => s + Math.abs(c.market_cap || 0), 0)
  if (total <= 0 || W <= 0 || H <= 0) return []

  const areaScale = (W * H) / total
  // Floor tiny/zero market caps to a small positive area so every coin gets
  // at least a sliver instead of a zero-size (invisible, div-by-zero-prone) rect.
  const items = coins.map(c => ({ ...c, area: Math.max(Math.abs(c.market_cap || 0), total * 0.00005) * areaScale }))

  const worstRatio = (row, rowThickness) => {
    let worst = 0
    for (const it of row) {
      const itemLength = it.area / rowThickness
      const ratio = Math.max(itemLength / rowThickness, rowThickness / itemLength)
      if (ratio > worst) worst = ratio
    }
    return worst
  }

  const rects = []
  let remaining = items
  let rx = 0, ry = 0, rw = W, rh = H

  while (remaining.length > 0) {
    const shortSide = Math.min(rw, rh)
    let row = [remaining[0]]
    let bestWorst = worstRatio(row, Math.max(row.reduce((s, i) => s + i.area, 0) / shortSide, 0.0001))

    let taken = 1
    for (let i = 1; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]]
      const candidateSum = candidate.reduce((s, it) => s + it.area, 0)
      const candidateThickness = Math.max(candidateSum / shortSide, 0.0001)
      const candidateWorst = worstRatio(candidate, candidateThickness)
      if (candidateWorst <= bestWorst || row.length === 0) {
        row = candidate
        bestWorst = candidateWorst
        taken = i + 1
      } else {
        break
      }
    }

    const rowSum = row.reduce((s, it) => s + it.area, 0)
    const rowThickness = Math.max(rowSum / shortSide, 0.0001)

    if (rw >= rh) {
      // Short side is height: row fills the full remaining height, extends
      // rightward by rowThickness.
      let cy = ry
      for (const it of row) {
        const itemH = (it.area / rowSum) * rh
        rects.push({ ...it, x: rx, y: cy, w: rowThickness, h: itemH })
        cy += itemH
      }
      rx += rowThickness
      rw -= rowThickness
    } else {
      // Short side is width: row fills the full remaining width, extends
      // downward by rowThickness.
      let cx = rx
      for (const it of row) {
        const itemW = (it.area / rowSum) * rw
        rects.push({ ...it, x: cx, y: ry, w: itemW, h: rowThickness })
        cx += itemW
      }
      ry += rowThickness
      rh -= rowThickness
    }

    remaining = remaining.slice(taken)
  }

  return rects
}

export default function Heatmap() {
  const { coins, fetchCoins } = useCryptoStore()
  const canvasRef = useRef(null)
  const [metric, setMetric] = useState('24h')
  const [top, setTop] = useState(100)

  useEffect(() => { fetchCoins() }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !coins.length) return
    const ctx = canvas.getContext('2d')
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    const topCoins = coins.slice(0, top).filter(c => c.market_cap > 0)
    const rects = squarify(topCoins, W, H)

    ctx.clearRect(0, 0, W, H)
    rects.forEach(r => {
      const pct = metric === '24h' ? r.price_change_percentage_24h : r.price_change_percentage_7d_in_currency
      const intensity = Math.min(Math.abs(pct || 0) / 10, 1)
      const isUp = (pct || 0) >= 0
      const base = isUp ? [77, 255, 110] : [255, 77, 77]
      const bg = `rgba(${base[0]},${base[1]},${base[2]},${0.08 + intensity * 0.35})`
      const border = `rgba(${base[0]},${base[1]},${base[2]},${0.2 + intensity * 0.3})`

      ctx.fillStyle = bg
      ctx.strokeStyle = border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
      ctx.fill()
      ctx.stroke()

      if (r.w > 30 && r.h > 20) {
        const fontSize = Math.min(r.w / 5, r.h / 3, 14)
        ctx.fillStyle = isUp ? '#4dff6e' : '#ff4d4d'
        ctx.font = `700 ${fontSize}px Inter`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(r.symbol.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 - (r.h > 40 ? 8 : 0))
        if (r.h > 40) {
          ctx.fillStyle = 'rgba(255,255,255,.5)'
          ctx.font = `400 ${Math.max(8, fontSize * 0.7)}px Inter`
          ctx.fillText((pct >= 0 ? '▲' : '▼') + Math.abs(pct || 0).toFixed(1) + '%', r.x + r.w / 2, r.y + r.h / 2 + fontSize * 0.8)
        }
      }
    })
  }, [coins, metric, top])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '.5px' }}>METRIC</span>
        {['24h', '7d'].map(m => (
          <button key={m} className={`btn ${metric === m ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setMetric(m)}>{m}</button>
        ))}
        <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 12, letterSpacing: '.5px' }}>TOP</span>
        {[50, 100, 200].map(n => (
          <button key={n} className={`btn ${top === n ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setTop(n)}>{n}</button>
        ))}
        <button className="btn btn-ghost" onClick={() => fetchCoins(true)} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>
      <div className="card" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!coins.length ? <div className="spinner" /> : (
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 10, color: 'var(--text2)' }}>
        <span>🟢 Gaining &nbsp; Size = Market Cap &nbsp; Color intensity = % Change</span>
        <span>🔴 Losing</span>
      </div>
    </div>
  )
}
