// Server-side proxy for Binance USDT-M perpetual futures funding rates.
// Runs on Netlify's infra, not the visitor's network — avoids Binance's
// geo-block on requests coming straight from a browser in a restricted
// region, and avoids client-side CORS entirely.
export default async (req) => {
  try {
    const symbol = new URL(req.url).searchParams.get('symbol')
    const upstream = symbol
      ? `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol.toUpperCase())}`
      : 'https://fapi.binance.com/fapi/v1/premiumIndex'
    const r = await fetch(upstream)
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `Binance returned ${r.status}` }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const data = await r.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30', // funding data doesn't need to be hit every render
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/funding-rates' }
