# OnyxCapital — Let's Trade

A desktop-only crypto trading terminal (paper trading + live market data) with
trades logged onchain to **0G Chain** and journal/DCA data persisted to
**0G Storage** — giving users a verifiable, tamper-proof trading record
instead of a private database entry.

Built by [@onyxcapita](https://x.com/onyxcapita) for the 0G Bridge Buildathon (Wave 3).
🔗 Live app: onyxcapitalog.netlify.app
🎥 Demo video: youtu.be/h0F0ANbNHWY
🐦 Submission post: x.com/Web3alphazl/status/2095157250230714692

## Problem it solves

Paper-trading and journaling tools store your trade history in a database
the operator controls — it can be edited, lost, or disputed. OnyxCapital
hashes every trade and writes it to a `TradeLog` contract on 0G Chain, so a
user's track record is independently verifiable on-chain rather than
"trust me" data in someone's backend.

## 0G components used

| Component | How it's used |
|---|---|
| **0G Chain** | `contracts/TradeLog.sol` — a minimal onchain trade log + reputation counter. Every trade placed in the app is hashed client-side and logged via `logTrade()`, emitting a `TradeLogged` event. Deployed to 0G-Aristotle mainnet (chain ID `16661`). |
| **0G Storage** | Journal entries, DCA plans, and backtest results are uploaded as JSON blobs to 0G Storage's mainnet indexer gateway, returning a root hash the user can verify independently of the app. |

Wallet connect (via `ethers.js`) prompts users to add/switch to 0G-Aristotle
automatically. A live "0G" status widget in the app shows sync state per
trade (pending → confirmed, linking straight to the 0G Explorer).

## Architecture

Single-page static app — no backend server required.

```
index.html          — the entire UI (markets, trade terminal, journal, etc.)
zerog.js / zerog.css — 0G Chain wallet connect, TradeLog contract calls,
                        0G Storage uploads, and the floating 0G status widget
contracts/
  TradeLog.sol       — onchain trade log contract (Solidity 0.8.19)
  DEPLOY.md          — step-by-step Foundry deploy guide for TradeLog.sol
netlify/functions/
  funding-rates.js   — serverless proxy for Binance funding-rate data
                        (avoids client-side geo-blocking issues)
```

Market data (prices, funding rates, DeFi yields) comes from public REST
APIs (CoinGecko, Binance, DeFiLlama) — proxied through a Netlify Function
where direct browser calls are unreliable.

The app is gated to desktop screens only (see the `DESKTOP ONLY` check in
`index.html`) — it's built around a dense, multi-panel trading workflow
that isn't meant for a phone screen.

## Setup / local run

No build step — it's plain HTML/JS/CSS.

1. Clone the repo
2. Serve the folder with any static file server, e.g.:
   ```bash
   npx serve .
   ```
3. Open the printed local URL in a desktop browser
4. Click "Connect 0G Wallet" in the Trade tab (MetaMask will prompt to
   add 0G-Aristotle mainnet if it's not already configured)

To redeploy `TradeLog.sol` yourself (e.g. for your own submission), see
[`contracts/DEPLOY.md`](contracts/DEPLOY.md).

## Deployment

Hosted as a static site on Netlify. `netlify.toml` publishes the repo root
as-is (no build step) and deploys `netlify/functions/` for the market-data
proxy.

## Live 0G integration proof

- **TradeLog contract**: `0xAf6aDF8a33d172F00Da6345C2A18b2D122287e43` on 0G-Aristotle mainnet
- **Explorer**: `https://chainscan.0g.ai/address/0xAf6aDF8a33d172F00Da6345C2A18b2D122287e43`
