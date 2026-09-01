# Deploying TradeLog.sol to 0G Chain Mainnet

Chain: **0G-Aristotle** (mainnet) — Chain ID `16661`, RPC `https://evmrpc.0g.ai`,
Explorer `https://chainscan.0g.ai`

## 1. Install Foundry (if you don't have it)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## 2. Set up a deploy folder

```bash
mkdir onyxcapital-contracts && cd onyxcapital-contracts
forge init --no-git
cp /path/to/contracts/TradeLog.sol src/TradeLog.sol
```

## 3. Fund a wallet with 0G

You need a wallet (private key) holding some 0G mainnet token to pay gas.
Bridge/acquire 0G to a fresh wallet — **never use your main wallet's private
key for scripting/deploys**, use a throwaway deploy key.

```bash
export PRIVATE_KEY=0xyourdeploykey
```

## 4. Deploy with Foundry

```bash
forge create --rpc-url https://evmrpc.0g.ai \
  --private-key $PRIVATE_KEY \
  --evm-version cancun \
  src/TradeLog.sol:TradeLog
```

This prints a `Deployed to: 0x...` address — that's your contract address.

## 5. Verify on the explorer (recommended for judging credibility)

```bash
# open https://chainscan.0g.ai
# paste your contract address, choose "Verify Contract"
# solc version: 0.8.19, evmVersion: cancun, license: MIT
# paste the full TradeLog.sol source
```

A verified contract lets judges read your source directly on-chain — good
for the "0G Integration" and "Technical Quality" scoring criteria.

## 6. Wire the address into the app

Open `src/lib/onchain.js` and set:

```js
export const TRADELOG_CONTRACT_ADDRESS = '0xYourDeployedAddress'
```

## 7. Test end-to-end

1. `npm run dev`
2. Click "Connect 0G Wallet" in the Trade page — MetaMask should prompt to
   add/switch to 0G-Aristotle automatically
3. Place a trade — watch the `0G` column go ⏳ → ✅
4. Click the ✅ to confirm it opens the transaction on `chainscan.0g.ai`

## Notes for the buildathon submission

- Keep the deploy key funded with a little extra 0G — every `logTrade` call
  costs gas, and judges may place test trades while reviewing
- Save the contract address + a chainscan link in your README and demo
  video — this is the "0G mainnet contract address" + "0G Explorer link"
  the submission requirements explicitly ask for
- If you redeploy (e.g. fixing a bug), update `TRADELOG_CONTRACT_ADDRESS`
  and note the new address in your Wave submission notes
