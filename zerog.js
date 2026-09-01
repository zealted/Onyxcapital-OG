/* ════════════════════════════════════════════════════════════════════
   0G INTEGRATION — OnyxCapital x 0G Chain / 0G Storage
   ------------------------------------------------------------------
   Kept entirely separate from the core app logic in index.html.
   Loaded as a plain script after the main app script, so it can see
   the app's globals (State, closePosition, renderJournalTab, toast)
   and hook into them without the core app needing to know 0G exists.

   Requires ethers (loaded via CDN in index.html, exposes window.ethers)
   before this file.
   ════════════════════════════════════════════════════════════════════ */

const ZeroG = (() => {

  // ── Config ──────────────────────────────────────────────────────────
  // Confirmed against 0G's official chain list (0G-Aristotle mainnet).
  const CHAIN = {
    chainIdHex: '0x' + (16661).toString(16),
    chainIdDec: 16661,
    chainName: '0G-Aristotle',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: ['https://evmrpc.0g.ai'],
    blockExplorerUrls: ['https://chainscan.0g.ai'],
  };

  // Confirmed against 0G's own docs (docs.0g.ai/developer-hub/testnet/testnet-overview).
  // NOTE: no verified DEX (SwapRouter/Quoter/WOG) addresses exist for testnet yet —
  // only mainnet's are documented/corroborated. Swap features stay mainnet-only
  // until testnet equivalents are confirmed; testnet mode is wallet/balance only.
  const TESTNET_CHAIN = {
    chainIdHex: '0x' + (16601).toString(16),
    chainIdDec: 16601,
    chainName: '0G-Galileo-Testnet',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: ['https://evmrpc-testnet.0g.ai'],
    blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
  };
  const FAUCET_URL = 'https://faucet.0g.ai';

  let activeNetwork = 'mainnet'; // 'mainnet' | 'testnet'
  function currentChainConfig(){ return activeNetwork === 'testnet' ? TESTNET_CHAIN : CHAIN; }

  // ⚠️ Set this after deploying contracts/TradeLog.sol — see contracts/DEPLOY.md
  // Deployed to 0G-Aristotle mainnet — tx 0xfd4a48d2fa777e7b0922cd2922d479a5be79d692611effcf4e3640aa51cb7a0e
  const TRADELOG_CONTRACT_ADDRESS = '0xAf6aDF8a33d172F00Da6345C2A18b2D122287e43';

  const TRADELOG_ABI = [
    'function logTrade(bytes32 tradeHash, string coin, string side) external',
    'function getTradeCount(address trader) external view returns (uint256)',
    'event TradeLogged(address indexed trader, bytes32 indexed tradeHash, string coin, string side, uint256 timestamp)',
  ];

  // 0G Storage gateway — confirmed mainnet indexer via build.0g.ai/hacker-guide/.
  const STORAGE_GATEWAY = 'https://indexer-storage.0g.ai';
  const STORAGE_EXPLORER = 'https://storagescan.0g.ai';

  // ── Spot swap (BETA) ──────────────────────────────────────────────
  // ⚠️ These addresses are NOT from 0G's own official docs — they come
  // from a Rabby Wallet integration request (github.com/RabbyHub/Rabby
  // issue #3225) describing them as unmodified Uniswap V3 forks,
  // verified on chainscan.0g.ai. Corroborated, but not officially
  // published by 0G. VERIFY THESE YOURSELF on chainscan.0g.ai before
  // relying on them for anything beyond small test amounts.
  const WOG_ADDRESS = '0x1Cd0690fF9a693f5EF2dD976660a8dAFc81A109c'; // wrapped 0G
  const SWAP_ROUTER_ADDRESS = '0x18cCa38E51c4C339A6BD6e174025f08360FEEf30';
  const QUOTER_ADDRESS = '0x23b55293b7F06F6c332a0dDA3D88d8921218425B';
  const DEFAULT_FEE_TIER = 3000; // 0.3% — standard Uniswap V3 default

  const WOG_ABI = [
    'function deposit() payable',
    'function withdraw(uint256 amount)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
  ];
  const ERC20_ABI = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
  ];
  const QUOTER_ABI = [
    'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
  ];
  const ROUTER_ABI = [
    'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  ];

  const LS_KEY = 'onyx_zerog_state';

  // ── Icon set (inline SVG, stroke-based, matches host app's line-icon feel) ──
  const ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    chain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a3 3 0 0 0 3 3l3-3a3 3 0 0 0-3-3l-1 1M15 12a3 3 0 0 0-3-3l-3 3a3 3 0 0 0 3 3l1-1"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4a2 2 0 1 0 0 4"/></svg>',
    database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>',
  };

  // ── Internal state ──────────────────────────────────────────────────
  let provider = null;
  let signer = null;
  let contract = null;
  let walletAddress = null;
  let connecting = false;

  // syncLog: [{ type:'chain'|'storage', label, status, txHash/rootHash, explorerUrl, ts }]
  let syncLog = [];
  let journalBackup = null; // { status, rootHash, explorerUrl, error }
  let nativeBalance = null; // formatted string, e.g. "1.2345"
  let activeTab = 'trade'; // 'trade' | 'chain' | 'storage'

  // Spot swap (beta) working state — not persisted, resets per session.
  let wogBalance = null;
  let swapDirection = 'toToken'; // 'toToken' (WOG→token) | 'toWog' (token→WOG)
  let swapTokenAddress = '';
  let swapAmountIn = '';
  let swapSlippagePct = 1; // percent
  let swapQuote = null;      // { amountOut, tokenSymbol, tokenDecimals }
  let swapTargetBalance = null; // formatted balance of the non-WOG token, once known
  let swapStatus = null;     // 'wrapping' | 'unwrapping' | 'quoting' | 'approving' | 'swapping' | 'error'
  let swapError = null;
  let swapLastTx = null;     // { txHash, explorerUrl }

  const BRIDGE_URL = 'https://xswap.link/bridge?toChain=16661';
  const SWAP_URL = 'https://hub.0g.ai/swap';

  loadPersisted();

  function loadPersisted(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return;
      const data = JSON.parse(raw);
      if(Array.isArray(data.syncLog)) syncLog = data.syncLog.slice(0, 30);
      if(data.journalBackup) journalBackup = data.journalBackup;
    }catch(e){ /* start fresh */ }
  }
  function persist(){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify({ syncLog: syncLog.slice(0,30), journalBackup }));
    }catch(e){ /* never crash app on save */ }
  }

  // ── Wallet connect ──────────────────────────────────────────────────
  async function ensureChain(chainConfig){
    try{
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainConfig.chainIdHex }],
      });
    }catch(switchErr){
      if(switchErr.code === 4902){
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainConfig.chainIdHex,
            chainName: chainConfig.chainName,
            nativeCurrency: chainConfig.nativeCurrency,
            rpcUrls: chainConfig.rpcUrls,
            blockExplorerUrls: chainConfig.blockExplorerUrls,
          }],
        });
      } else {
        throw switchErr;
      }
    }
  }

  async function connectWallet(){
    if(connecting) return;
    if(!window.ethereum){
      notify('No wallet found', 'Install MetaMask (or another injected wallet) to connect to 0G Chain.', 'fail');
      return;
    }
    connecting = true;
    updateFab();
    try{
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await ensureChain(currentChainConfig());

      provider = new window.ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      walletAddress = await signer.getAddress();
      if(TRADELOG_CONTRACT_ADDRESS && activeNetwork === 'mainnet'){
        contract = new window.ethers.Contract(TRADELOG_CONTRACT_ADDRESS, TRADELOG_ABI, signer);
      } else {
        contract = null;
      }
      await refreshBalance();

      if(typeof toast === 'function') toast('0G wallet connected');
      renderModal();
    }catch(e){
      notify('Connection failed', e.message || String(e), 'fail');
    }finally{
      connecting = false;
      updateFab();
    }
  }

  function isConfigured(){
    return !!TRADELOG_CONTRACT_ADDRESS;
  }

  // ── Live balance: real, read-only, from the connected wallet on mainnet ──
  async function switchNetwork(target){
    if(target === activeNetwork) return;
    activeNetwork = target;
    swapQuote = null; swapError = null; swapLastTx = null; wogBalance = null; swapTargetBalance = null;
    if(walletAddress && window.ethereum){
      try{
        await ensureChain(currentChainConfig());
        provider = new window.ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        contract = (TRADELOG_CONTRACT_ADDRESS && activeNetwork === 'mainnet')
          ? new window.ethers.Contract(TRADELOG_CONTRACT_ADDRESS, TRADELOG_ABI, signer)
          : null;
        await refreshBalance();
      }catch(e){
        notify('Network switch failed', e.message || String(e), 'fail');
      }
    }
    renderSpotOverlay();
  }

  async function refreshBalance(){
    if(!provider || !walletAddress) return;
    try{
      const raw = await provider.getBalance(walletAddress);
      nativeBalance = window.ethers.formatEther(raw);
    }catch(e){
      nativeBalance = null;
    }
    if(activeNetwork === 'mainnet') await refreshWogBalance();
    renderModal();
    renderSpotOverlay();
  }

  async function refreshWogBalance(){
    if(!signer || !walletAddress) return;
    try{
      const wog = new window.ethers.Contract(WOG_ADDRESS, WOG_ABI, signer);
      const raw = await wog.balanceOf(walletAddress);
      wogBalance = window.ethers.formatEther(raw);
    }catch(e){
      wogBalance = null;
    }
  }

  // ── Spot swap (BETA) — wrap native 0G, quote, then swap via 0G's
  // community-verified Uniswap V3 fork. See the address warning above. ──
  async function wrapToWog(amountStr){
    if(!signer) return;
    swapStatus = 'wrapping'; swapError = null;
    renderSpotOverlay();
    try{
      const wog = new window.ethers.Contract(WOG_ADDRESS, WOG_ABI, signer);
      const tx = await wog.deposit({ value: window.ethers.parseEther(amountStr) });
      await tx.wait();
      await refreshBalance();
      notify('Wrapped to WOG', `${amountStr} 0G wrapped — ready to swap.`, 'ok');
    }catch(e){
      swapError = e?.shortMessage || e?.message || 'Wrap failed';
      notify('Wrap failed', swapError, 'fail');
    }finally{
      swapStatus = null;
      renderSpotOverlay();
    }
  }

  async function unwrapFromWog(amountStr){
    if(!signer) return;
    swapStatus = 'unwrapping'; swapError = null;
    renderSpotOverlay();
    try{
      const wog = new window.ethers.Contract(WOG_ADDRESS, WOG_ABI, signer);
      const tx = await wog.withdraw(window.ethers.parseEther(amountStr));
      await tx.wait();
      await refreshBalance();
      notify('Unwrapped', `${amountStr} WOG converted back to native 0G.`, 'ok');
    }catch(e){
      swapError = e?.shortMessage || e?.message || 'Unwrap failed';
      notify('Unwrap failed', swapError, 'fail');
    }finally{
      swapStatus = null;
      renderSpotOverlay();
    }
  }

  function toggleSwapDirection(){
    swapDirection = swapDirection === 'toToken' ? 'toWog' : 'toToken';
    swapQuote = null; swapError = null;
    renderSpotOverlay();
  }

  async function fetchSwapQuote(){
    if(!signer || !swapTokenAddress || !swapAmountIn) return;
    swapStatus = 'quoting'; swapError = null; swapQuote = null;
    renderSpotOverlay();
    try{
      const token = new window.ethers.Contract(swapTokenAddress, ERC20_ABI, signer);
      const [symbol, decimals, targetBalRaw] = await Promise.all([
        token.symbol(), token.decimals(), token.balanceOf(walletAddress),
      ]);
      swapTargetBalance = window.ethers.formatUnits(targetBalRaw, decimals);

      const fromWog = swapDirection === 'toToken';
      const tokenIn = fromWog ? WOG_ADDRESS : swapTokenAddress;
      const tokenOut = fromWog ? swapTokenAddress : WOG_ADDRESS;
      const inDecimals = fromWog ? 18 : decimals;
      const outDecimals = fromWog ? decimals : 18;
      const amountIn = window.ethers.parseUnits(swapAmountIn, inDecimals);

      const quoter = new window.ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, signer);
      const result = await quoter.quoteExactInputSingle.staticCall({
        tokenIn, tokenOut, amountIn, fee: DEFAULT_FEE_TIER, sqrtPriceLimitX96: 0,
      });

      swapQuote = {
        amountOutRaw: result.amountOut,
        amountOut: window.ethers.formatUnits(result.amountOut, outDecimals),
        tokenSymbol: symbol,
        tokenDecimals: decimals,
        outSymbol: fromWog ? symbol : 'WOG',
      };
    }catch(e){
      swapError = e?.shortMessage || e?.message || 'Could not fetch a quote — check the token address and that a pool exists for this pair.';
      notify('Quote failed', swapError, 'fail');
    }finally{
      swapStatus = null;
      renderSpotOverlay();
    }
  }

  async function executeSwap(){
    if(!signer || !swapQuote || !walletAddress) return;
    swapStatus = 'approving'; swapError = null;
    renderSpotOverlay();
    try{
      const fromWog = swapDirection === 'toToken';
      const tokenInAddr = fromWog ? WOG_ADDRESS : swapTokenAddress;
      const tokenOutAddr = fromWog ? swapTokenAddress : WOG_ADDRESS;
      const inDecimals = fromWog ? 18 : swapQuote.tokenDecimals;
      const amountIn = window.ethers.parseUnits(swapAmountIn, inDecimals);

      const tokenInContract = new window.ethers.Contract(tokenInAddr, ERC20_ABI, signer);
      const allowance = await tokenInContract.allowance(walletAddress, SWAP_ROUTER_ADDRESS);

      if(allowance < amountIn){
        const approveTx = await tokenInContract.approve(SWAP_ROUTER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      swapStatus = 'swapping';
      renderSpotOverlay();

      const slippage = Math.max(0.1, Math.min(50, Number(swapSlippagePct) || 1));
      const minOut = (swapQuote.amountOutRaw * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

      const router = new window.ethers.Contract(SWAP_ROUTER_ADDRESS, ROUTER_ABI, signer);
      const tx = await router.exactInputSingle({
        tokenIn: tokenInAddr,
        tokenOut: tokenOutAddr,
        fee: DEFAULT_FEE_TIER,
        recipient: walletAddress,
        deadline,
        amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0,
      });
      const receipt = await tx.wait();
      const explorerUrl = `${CHAIN.blockExplorerUrls[0]}/tx/${receipt.hash}`;
      swapLastTx = { txHash: receipt.hash, explorerUrl };

      syncLog.unshift({ type: 'chain', label: `Swap → ${swapQuote.outSymbol}`, status: 'confirmed', txHash: receipt.hash, explorerUrl, ts: Date.now() });
      persist();

      await refreshBalance();
      swapQuote = null; swapAmountIn = '';
      notify('Swap complete', `<a href="${explorerUrl}" target="_blank" rel="noreferrer">View transaction</a>`, 'ok');
    }catch(e){
      swapError = e?.shortMessage || e?.message || 'Swap failed';
      notify('Swap failed', swapError, 'fail');
    }finally{
      swapStatus = null;
      renderSpotOverlay();
    }
  }

  // ── 0G Chain: log a closed trade ─────────────────────────────────────
  function hashTrade(trade){
    const payload = JSON.stringify({
      symbol: trade.symbol, side: trade.side, qty: trade.qty,
      entryPrice: trade.entryPrice, exitPrice: trade.exitPrice, closeTime: trade.closeTime,
    });
    return window.ethers.keccak256(window.ethers.toUtf8Bytes(payload));
  }

  async function onTradeClosed(trade){
    if(!walletAddress){
      trade._zerogStatus = 'off';
      return;
    }
    if(!contract){
      trade._zerogStatus = 'unconfigured';
      return;
    }
    trade._zerogStatus = 'pending';
    refreshJournalIfOpen();

    const entry = { type: 'chain', label: `${trade.symbol} ${trade.side}`, status: 'pending', ts: Date.now() };
    syncLog.unshift(entry);
    persist();
    updateFab();

    try{
      const tradeHash = hashTrade(trade);
      const tx = await contract.logTrade(tradeHash, trade.symbol, trade.side);
      const receipt = await tx.wait();
      const explorerUrl = `${CHAIN.blockExplorerUrls[0]}/tx/${receipt.hash}`;

      trade._zerogStatus = 'confirmed';
      trade._zerogTx = receipt.hash;
      trade._zerogExplorerUrl = explorerUrl;

      entry.status = 'confirmed';
      entry.txHash = receipt.hash;
      entry.explorerUrl = explorerUrl;
      persist();

      notify('Trade synced to 0G Chain', `${trade.symbol} ${trade.side} logged onchain — <a href="${explorerUrl}" target="_blank" rel="noreferrer">view tx</a>`, 'ok');
    }catch(e){
      trade._zerogStatus = 'failed';
      entry.status = 'failed';
      entry.error = e.message;
      persist();
      notify('Onchain sync failed', trade.symbol + ' ' + trade.side + ' — trade is still saved locally', 'fail');
    }finally{
      refreshJournalIfOpen();
      updateFab();
      renderModal();
    }
  }

  // ── 0G Storage: backup the whole journal ─────────────────────────────
  async function backupJournal(){
    const trades = (window.State && window.State.tradeHistory) || [];
    if(!trades.length){
      notify('Nothing to back up', 'Close at least one trade first.', 'fail');
      return;
    }
    journalBackup = { status: 'pending' };
    persist();
    renderModal();

    try{
      const payload = JSON.stringify(trades);
      const blob = new Blob([payload], { type: 'application/json' });
      const form = new FormData();
      form.append('file', blob, `onyxcapital-journal-${Date.now()}.json`);

      const res = await fetch(`${STORAGE_GATEWAY}/file`, { method: 'POST', body: form });
      if(!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      const rootHash = json.rootHash || json.root_hash || json.hash;
      if(!rootHash) throw new Error('0G Storage did not return a root hash');

      const explorerUrl = `${STORAGE_EXPLORER}/tx/${rootHash}`;
      journalBackup = { status: 'confirmed', rootHash, explorerUrl, ts: Date.now() };
      syncLog.unshift({ type: 'storage', label: `Journal (${trades.length} trades)`, status: 'confirmed', rootHash, explorerUrl, ts: Date.now() });
      persist();
      notify('Backed up to 0G Storage', `${trades.length} trades stored — <a href="${explorerUrl}" target="_blank" rel="noreferrer">view</a>`, 'ok');
    }catch(e){
      journalBackup = { status: 'failed', error: e.message };
      persist();
      notify('0G Storage backup failed', e.message, 'fail');
    }finally{
      renderModal();
      updateFab();
    }
  }

  // ── Hook into the app ─────────────────────────────────────────────
  function installHooks(){
    if(typeof window.closePosition === 'function' && !window.closePosition._zerogWrapped){
      const original = window.closePosition;
      const wrapped = function(idx){
        original(idx);
        const latest = window.State && window.State.tradeHistory && window.State.tradeHistory[0];
        if(latest) onTradeClosed(latest);
      };
      wrapped._zerogWrapped = true;
      window.closePosition = wrapped;
    }

    if(typeof window.renderJournalTab === 'function' && !window.renderJournalTab._zerogWrapped){
      const original = window.renderJournalTab;
      const wrapped = function(content){
        original(content);
        injectJournalBadges();
      };
      wrapped._zerogWrapped = true;
      window.renderJournalTab = wrapped;
    }
  }

  function refreshJournalIfOpen(){
    const content = document.getElementById('journalList');
    if(content) injectJournalBadges();
  }

  function injectJournalBadges(){
    const list = document.getElementById('journalList');
    if(!list || !window.State) return;
    const rows = list.children;
    const trades = window.State.tradeHistory.slice(0, 40);
    for(let i=0;i<rows.length && i<trades.length;i++){
      const row = rows[i];
      if(row.querySelector('.zerogInlineBadge')) continue; // already injected
      const t = trades[i];
      const badge = document.createElement('div');
      badge.className = 'zerogInlineBadge';
      badge.innerHTML = renderInlineBadgeHtml(t);
      row.appendChild(badge);
    }
  }

  function renderInlineBadgeHtml(t){
    switch(t._zerogStatus){
      case 'confirmed': return `${ICON.check} <a href="${t._zerogExplorerUrl}" target="_blank" rel="noreferrer">Synced to 0G Chain</a>`;
      case 'pending': return `Syncing to 0G Chain…`;
      case 'failed': return `${ICON.alert} 0G sync failed`;
      case 'unconfigured': return `— 0G contract not deployed yet`;
      default: return `— Not synced (connect 0G wallet)`;
    }
  }

  // ── UI: floating badge, toast-popup, modal ───────────────────────────
  function buildUi(){
    const fab = document.createElement('div');
    fab.id = 'zerogFab';
    fab.title = 'OnyxCapital x 0G — click to view sync status';
    fab.innerHTML = `
      <div class="zerogOrbit"></div>
      <div class="zerogBody">
        <div class="zerogFace">
          <span class="zerogEye l"></span>
          <span class="zerogEye r"></span>
          <span class="zerogMouth"></span>
        </div>
      </div>
      <span class="zerogStatusDot"></span>`;
    fab.onclick = openModal;
    document.body.appendChild(fab);

    const popup = document.createElement('div');
    popup.id = 'zerogPopup';
    document.body.appendChild(popup);

    const overlay = document.createElement('div');
    overlay.id = 'zerogModalOverlay';
    overlay.innerHTML = `
      <div id="zerogModal">
        <div class="zerogModalHead">
          <div class="zerogHeadTitle">
            <div class="zerogHeadLogo">${ICON.chain}</div>
            <div>
              <h3>OnyxCapital x 0G</h3>
              <div class="zerogHeadSub">0G-Aristotle mainnet</div>
            </div>
          </div>
          <span class="zerogClose" id="zerogCloseBtn">${ICON.close}</span>
        </div>
        <div class="zerogWalletBar" id="zerogWalletBar"></div>
        <div class="zerogTabs" id="zerogTabs">
          <button class="zerogTab" data-tab="trade">${ICON.wallet}<span>Live Trade</span></button>
          <button class="zerogTab" data-tab="chain">${ICON.chain}<span>Chain Log</span></button>
          <button class="zerogTab" data-tab="storage">${ICON.database}<span>Storage</span></button>
        </div>
        <div class="zerogModalBody" id="zerogModalBody"></div>
      </div>`;
    overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
    document.body.appendChild(overlay);
    document.getElementById('zerogCloseBtn').onclick = closeModal;

    updateFab();
    renderModal();
  }

  function updateFab(){
    const fab = document.getElementById('zerogFab');
    if(!fab) return;
    fab.classList.remove('connected','pending');
    if(connecting){
      fab.classList.add('pending');
      fab.title = 'Connecting to 0G…';
    } else if(walletAddress){
      fab.classList.add('connected');
      fab.title = `OnyxCapital x 0G — connected (${walletAddress.slice(0,6)}…${walletAddress.slice(-4)})`;
    } else {
      fab.title = 'OnyxCapital x 0G — click to connect your wallet';
    }
  }

  function openModal(){
    document.getElementById('zerogModalOverlay').classList.add('show');
    renderModal();
  }
  function closeModal(){
    document.getElementById('zerogModalOverlay').classList.remove('show');
  }

  function notify(title, bodyHtml, kind){
    const popup = document.getElementById('zerogPopup');
    if(!popup) return;
    const icon = kind === 'ok' ? ICON.check : kind === 'fail' ? ICON.alert : ICON.info;
    const color = kind === 'ok' ? '#02C076' : kind === 'fail' ? '#F6465D' : 'var(--zg-accent)';
    popup.innerHTML = `<div class="zerogPopupTitle"><span style="color:${color};display:inline-flex;width:14px;height:14px;">${icon}</span>${title}</div><div class="zerogPopupBody">${bodyHtml}</div>`;
    popup.classList.add('show');
    clearTimeout(popup._timer);
    popup._timer = setTimeout(() => popup.classList.remove('show'), 5000);
  }

  function renderModal(){
    const body = document.getElementById('zerogModalBody');
    const tabsEl = document.getElementById('zerogTabs');
    const walletBar = document.getElementById('zerogWalletBar');
    if(!body) return;

    if(tabsEl){
      [...tabsEl.children].forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
        btn.onclick = () => { activeTab = btn.dataset.tab; renderModal(); };
      });
    }

    if(walletBar){
      walletBar.classList.toggle('connected', !!walletAddress);
      walletBar.innerHTML = walletAddress
        ? `<div class="zerogWalletInfo"><span class="zerogWalletDot"></span><span class="zerogAddr">${walletAddress.slice(0,8)}…${walletAddress.slice(-6)}</span></div><span class="zerogBadge ok">${ICON.check}Connected</span>`
        : `<div class="zerogWalletInfo"><span class="zerogWalletDot"></span><span class="zerogWalletMuted">Wallet not connected</span></div>
           <button class="zerogBtn primary" id="zerogConnectBtn" ${connecting ? 'disabled' : ''}>${connecting ? 'Connecting…' : 'Connect'}</button>`;
      const cbtn = document.getElementById('zerogConnectBtn');
      if(cbtn) cbtn.onclick = connectWallet;
    }

    let panel = '';
    if(activeTab === 'trade'){
      panel = renderTradeTab();
    } else if(activeTab === 'chain'){
      panel = renderChainTab();
    } else {
      panel = renderStorageTab();
    }

    body.innerHTML = panel;

    const backupBtn = document.getElementById('zerogBackupBtn');
    if(backupBtn) backupBtn.onclick = backupJournal;
    const refreshBtn = document.getElementById('zerogRefreshBalBtn');
    if(refreshBtn) refreshBtn.onclick = async () => {
      refreshBtn.classList.add('spinning');
      await refreshBalance();
    };

    const openSpotBtn = document.getElementById('zerogOpenSpotBtn');
    if(openSpotBtn) openSpotBtn.onclick = () => { closeModal(); openSpotOverlay(); };
  }

  function renderTradeTab(){
    if(!walletAddress){
      return `
        <div class="zerogNotice">
          ${ICON.info}
          <span>Connect your wallet above to see your real 0G-Aristotle balance and trade with
          your own funds — OnyxCapital never holds or touches your money.</span>
        </div>`;
    }

    const balanceDisplay = nativeBalance !== null ? Number(nativeBalance).toFixed(4) : '—';

    return `
      <div class="zerogHero">
        <div class="zerogHeroLabel">Your Real Balance</div>
        <div class="zerogHeroRow">
          <div class="zerogHeroValue">${balanceDisplay}<span class="zerogHeroUnit">0G</span></div>
          <button class="zerogIconBtn" id="zerogRefreshBalBtn" title="Refresh balance">${ICON.refresh}</button>
        </div>
        <div class="zerogHeroSub">Live from your wallet on mainnet — read directly from the chain, never stored.</div>
      </div>

      <div class="zerogStep">
        <div class="zerogStepNum">1</div>
        <div class="zerogStepBody">
          <h4>Deposit real funds</h4>
          <p>Bridge crypto onto 0G mainnet — it lands directly in <b>your own wallet</b>, never OnyxCapital.</p>
          <a href="${BRIDGE_URL}" target="_blank" rel="noreferrer" class="zerogBtn secondary">${ICON.external}Bridge Funds (XSwap)</a>
        </div>
      </div>

      <div class="zerogStep">
        <div class="zerogStepNum">2</div>
        <div class="zerogStepBody">
          <h4>Trade for real</h4>
          <p>Swap on 0G's own official exchange — your wallet stays in control, you approve every trade.</p>
          <a href="${SWAP_URL}" target="_blank" rel="noreferrer" class="zerogBtn primary">${ICON.external}Open 0G Hub Swap</a>
        </div>
      </div>

      <div class="zerogStep">
        <div class="zerogStepNum">3</div>
        <div class="zerogStepBody">
          <h4>Or swap right inside OnyxCapital</h4>
          <p>A full in-app spot trading page — wrap/unwrap, quote, and swap directly from your wallet, with a mainnet/testnet switch.</p>
          <button class="zerogBtn secondary" id="zerogOpenSpotBtn">${ICON.chain}Open Spot Trade</button>
        </div>
      </div>

      <div class="zerogNotice">
        ${ICON.info}
        <span>OnyxCapital doesn't custody funds or execute trades on your behalf — it reads your real
        balance and hands you off to 0G's own swap interface for execution. Your keys, your funds, always.</span>
      </div>`;
  }

  // ── Full-page Spot Trade overlay ───────────────────────────────────
  function buildSpotOverlay(){
    if(document.getElementById('zerogSpotOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'zerogSpotOverlay';
    overlay.innerHTML = `
      <div id="zerogSpotTopBar">
        <div class="zerogSpotTitle">${ICON.chain}<span>0G Spot Trade</span></div>
        <div id="zerogNetSwitch">
          <button class="zerogNetBtn" data-net="mainnet">Mainnet</button>
          <button class="zerogNetBtn" data-net="testnet">Testnet</button>
        </div>
        <button id="zerogSpotCloseBtn" title="Close">${ICON.close} Close</button>
      </div>
      <div id="zerogSpotBody"></div>`;
    document.body.appendChild(overlay);
    document.getElementById('zerogSpotCloseBtn').onclick = closeSpotOverlay;
    overlay.querySelectorAll('.zerogNetBtn').forEach(btn=>{
      btn.onclick = () => switchNetwork(btn.dataset.net);
    });
  }

  function openSpotOverlay(){
    buildSpotOverlay();
    document.getElementById('zerogSpotOverlay').classList.add('show');
    renderSpotOverlay();
  }
  function closeSpotOverlay(){
    const el = document.getElementById('zerogSpotOverlay');
    if(el) el.classList.remove('show');
  }

  function renderSpotOverlay(){
    const body = document.getElementById('zerogSpotBody');
    if(!body) return; // overlay not open yet — nothing to update

    document.querySelectorAll('.zerogNetBtn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.net === activeNetwork);
    });

    if(!walletAddress){
      body.innerHTML = `
        <div class="zerogSpotCard" style="text-align:center;padding:40px 24px;">
          ${ICON.wallet}
          <h3 style="margin:14px 0 6px;">Connect your wallet</h3>
          <p style="color:var(--dim);font-size:12.5px;margin-bottom:16px;">Connect to see your balance and trade directly from your own wallet on ${activeNetwork === 'mainnet' ? '0G-Aristotle mainnet' : '0G-Galileo testnet'}.</p>
          <button class="zerogBtn primary" id="zerogSpotConnectBtn">Connect Wallet</button>
        </div>`;
      document.getElementById('zerogSpotConnectBtn').onclick = connectWallet;
      return;
    }

    if(activeNetwork === 'testnet'){
      body.innerHTML = renderTestnetPanel();
      const faucetBtn = document.getElementById('zerogFaucetBtn');
      if(faucetBtn) faucetBtn.onclick = () => window.open(FAUCET_URL, '_blank');
      const refreshBtn = document.getElementById('zerogSpotRefreshBtn');
      if(refreshBtn) refreshBtn.onclick = refreshBalance;
      return;
    }

    body.innerHTML = renderMainnetSwapPanel();
    wireSpotOverlayInputs();
  }

  function renderTestnetPanel(){
    const balanceDisplay = nativeBalance !== null ? Number(nativeBalance).toFixed(4) : '—';
    return `
      <div class="zerogSpotCard">
        <div class="zerogHeroLabel">Testnet Balance</div>
        <div class="zerogHeroRow">
          <div class="zerogHeroValue">${balanceDisplay}<span class="zerogHeroUnit">0G</span></div>
          <button class="zerogIconBtn" id="zerogSpotRefreshBtn" title="Refresh">${ICON.refresh}</button>
        </div>
        <div class="zerogHeroSub">0G-Galileo-Testnet — free test tokens, no real value.</div>
      </div>
      <div class="zerogSpotCard">
        <h4 style="margin-bottom:8px;">Get free test 0G</h4>
        <p style="color:var(--dim);font-size:12px;margin-bottom:12px;">0G's official faucet gives 0.1 test 0G per wallet per day — enough for gas on testnet.</p>
        <button class="zerogBtn primary" id="zerogFaucetBtn">${ICON.external}Open 0G Faucet</button>
      </div>
      <div class="zerogNotice warn">
        ${ICON.alert}
        <span>Spot swapping isn't available on testnet yet — there's no officially verified DEX
        (SwapRouter/Quoter) deployment on 0G-Galileo to trade against, only on mainnet.
        Switch back to Mainnet above once you're ready to trade for real.</span>
      </div>`;
  }

  function renderMainnetSwapPanel(){
    const balanceDisplay = nativeBalance !== null ? Number(nativeBalance).toFixed(4) : '—';
    const wogDisplay = wogBalance !== null ? Number(wogBalance).toFixed(4) : '—';
    const targetDisplay = swapTargetBalance !== null ? Number(swapTargetBalance).toFixed(4) : '—';
    const busy = !!swapStatus;
    const fromWog = swapDirection === 'toToken';

    return `
      <div class="zerogSpotCard">
        <div class="zerogHeroLabel">Your Real Balance</div>
        <div class="zerogHeroRow">
          <div class="zerogHeroValue">${balanceDisplay}<span class="zerogHeroUnit">0G</span></div>
          <button class="zerogIconBtn" id="zerogSpotRefreshBtn" title="Refresh">${ICON.refresh}</button>
        </div>
        <div class="zerogHeroSub">Live from your wallet on 0G-Aristotle mainnet.</div>
      </div>

      <div class="zerogSpotCard" style="border-color:rgba(240,185,11,.3);">
        <h4 style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
          Spot Swap <span class="zerogBadge pending" style="text-transform:none;">BETA</span>
        </h4>
        <div class="zerogNotice warn" style="margin-bottom:14px;">
          ${ICON.alert}
          <span>Uses a community-reported (not officially 0G-documented) Uniswap V3 fork.
          <a href="https://chainscan.0g.ai/address/${SWAP_ROUTER_ADDRESS}" target="_blank" rel="noreferrer" style="color:inherit;text-decoration:underline;">Verify the router yourself</a>
          before swapping meaningful amounts.</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div style="background:var(--bg);border-radius:9px;padding:10px 12px;">
            <div style="font-size:9.5px;color:var(--dim);">WOG</div>
            <div style="font-size:15px;font-weight:700;">${wogDisplay}</div>
          </div>
          <div style="background:var(--bg);border-radius:9px;padding:10px 12px;">
            <div style="font-size:9.5px;color:var(--dim);">${swapQuote ? swapQuote.tokenSymbol : 'Token'}</div>
            <div style="font-size:15px;font-weight:700;">${targetDisplay}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-bottom:16px;">
          <input type="number" id="zerogWrapAmount" placeholder="Amount" min="0" step="any" class="zerogSpotInput">
          <button class="zerogBtn secondary" id="zerogWrapBtn" ${busy ? 'disabled' : ''}>${swapStatus === 'wrapping' ? 'Wrapping…' : 'Wrap →WOG'}</button>
          <button class="zerogBtn ghost" id="zerogUnwrapBtn" ${busy ? 'disabled' : ''}>${swapStatus === 'unwrapping' ? 'Unwrapping…' : 'Unwrap →0G'}</button>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:10.5px;color:var(--dim);">Token to trade (contract address)</div>
          <button class="zerogBtn ghost" id="zerogFlipBtn" style="padding:4px 10px;font-size:10px;" ${busy ? 'disabled' : ''}>${ICON.refresh} ${fromWog ? 'WOG → Token' : 'Token → WOG'}</button>
        </div>
        <input type="text" id="zerogSwapToken" value="${swapTokenAddress}" placeholder="0x..." class="zerogSpotInput zerogSpotMono" style="margin-bottom:10px;">

        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:12px;">
          <input type="number" id="zerogSwapAmount" value="${swapAmountIn}" placeholder="${fromWog ? 'Amount of WOG' : 'Amount of token'}" min="0" step="any" class="zerogSpotInput">
          <button class="zerogBtn secondary" id="zerogQuoteBtn" ${busy ? 'disabled' : ''}>${swapStatus === 'quoting' ? 'Quoting…' : 'Get Quote'}</button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span style="font-size:10.5px;color:var(--dim);">Slippage tolerance</span>
          <input type="number" id="zerogSlippage" value="${swapSlippagePct}" min="0.1" max="50" step="0.1" class="zerogSpotInput" style="width:70px;">
          <span style="font-size:10.5px;color:var(--dim);">%</span>
        </div>

        ${swapQuote ? `
          <div class="zerogRow" style="background:var(--bg);border-radius:9px;padding:12px 14px;margin-bottom:12px;">
            <span style="font-size:12px;color:var(--dim);">You'll receive (est.)</span>
            <span style="font-size:16px;font-weight:700;color:var(--text);">${Number(swapQuote.amountOut).toFixed(6)} ${swapQuote.outSymbol}</span>
          </div>
          <button class="zerogBtn primary" id="zerogSwapBtn" style="width:100%;justify-content:center;" ${busy ? 'disabled' : ''}>
            ${swapStatus === 'approving' ? 'Approving…' : swapStatus === 'swapping' ? 'Swapping…' : 'Confirm Swap'}
          </button>
        ` : ''}

        ${swapError ? `<div class="zerogNotice" style="margin-top:12px;background:rgba(246,70,93,.08);border-color:rgba(246,70,93,.3);"><span style="color:#F6465D;font-size:11px;">${swapError}</span></div>` : ''}
        ${swapLastTx ? `<div style="margin-top:12px;"><a href="${swapLastTx.explorerUrl}" target="_blank" rel="noreferrer" class="zerogBadge ok">${ICON.check}Last swap confirmed</a></div>` : ''}
      </div>

      <div class="zerogNotice">
        ${ICON.info}
        <span>OnyxCapital doesn't custody funds — every wrap, approve, and swap is a transaction you sign yourself.</span>
      </div>`;
  }

  function wireSpotOverlayInputs(){
    const tokenInput = document.getElementById('zerogSwapToken');
    if(tokenInput) tokenInput.oninput = (e) => {
      swapTokenAddress = e.target.value.trim();
      swapQuote = null; swapTargetBalance = null;
    };
    const amountInput = document.getElementById('zerogSwapAmount');
    if(amountInput) amountInput.oninput = (e) => { swapAmountIn = e.target.value; };
    const slippageInput = document.getElementById('zerogSlippage');
    if(slippageInput) slippageInput.oninput = (e) => { swapSlippagePct = e.target.value; };

    const refreshBtn = document.getElementById('zerogSpotRefreshBtn');
    if(refreshBtn) refreshBtn.onclick = refreshBalance;
    const wrapBtn = document.getElementById('zerogWrapBtn');
    if(wrapBtn) wrapBtn.onclick = () => {
      const amt = document.getElementById('zerogWrapAmount')?.value;
      if(amt && Number(amt) > 0) wrapToWog(amt);
    };
    const unwrapBtn = document.getElementById('zerogUnwrapBtn');
    if(unwrapBtn) unwrapBtn.onclick = () => {
      const amt = document.getElementById('zerogWrapAmount')?.value;
      if(amt && Number(amt) > 0) unwrapFromWog(amt);
    };
    const flipBtn = document.getElementById('zerogFlipBtn');
    if(flipBtn) flipBtn.onclick = () => { toggleSwapDirection(); renderSpotOverlay(); };
    const quoteBtn = document.getElementById('zerogQuoteBtn');
    if(quoteBtn) quoteBtn.onclick = () => {
      if(!swapTokenAddress || !swapAmountIn){
        notify('Missing info', 'Enter a token address and an amount first.', 'fail');
        return;
      }
      fetchSwapQuote().then(renderSpotOverlay);
    };
    const swapBtn = document.getElementById('zerogSwapBtn');
    if(swapBtn) swapBtn.onclick = () => executeSwap().then(renderSpotOverlay);
  }

  function renderChainTab(){
    const configNotice = !isConfigured() ? `
      <div class="zerogNotice warn">
        ${ICON.alert}
        <span>TradeLog contract address isn't set yet. Deploy <code>contracts/TradeLog.sol</code>
        (see <code>contracts/DEPLOY.md</code>) and paste the address into
        <code>TRADELOG_CONTRACT_ADDRESS</code> at the top of <code>zerog.js</code>.</span>
      </div>` : '';

    const logRows = syncLog.slice(0, 12).map(e => {
      const badgeClass = e.status === 'confirmed' ? 'ok' : e.status === 'pending' ? 'pending' : 'fail';
      const url = e.explorerUrl;
      const linkText = e.type === 'chain' ? (e.txHash ? e.txHash.slice(0,10)+'…' : '') : (e.rootHash ? e.rootHash.slice(0,10)+'…' : '');
      const icon = e.type === 'chain' ? ICON.chain : ICON.database;
      return `
        <div class="zerogLogRow">
          <span class="zerogLogLeft">${icon}${e.label}</span>
          ${url ? `<a href="${url}" target="_blank" rel="noreferrer">${linkText}</a>` : `<span class="zerogBadge ${badgeClass}">${e.status}</span>`}
        </div>`;
    }).join('');

    return `
      <div class="zerogSection">
        <h4>0G Chain — Trade Log</h4>
        <p>Every closed paper trade is hashed and logged to the TradeLog contract on 0G-Aristotle —
        a verifiable, tamper-proof trading history.</p>
        ${configNotice}
      </div>
      <div class="zerogSection">
        <h4>Recent Activity</h4>
        <div id="zerogLog">${logRows || `<div class="zerogEmpty">Nothing synced yet</div>`}</div>
      </div>`;
  }

  function renderStorageTab(){
    const trades = (window.State && window.State.tradeHistory) || [];
    return `
      <div class="zerogSection">
        <h4>0G Storage — Journal Backup</h4>
        <p>Push your full trade journal (${trades.length} trade${trades.length===1?'':'s'}) to 0G Storage
        so it's persistent and verifiable beyond this browser.</p>
        <div class="zerogRow">
          <button class="zerogBtn primary" id="zerogBackupBtn" ${journalBackup?.status === 'pending' || !trades.length ? 'disabled' : ''}>
            ${ICON.database}${journalBackup?.status === 'pending' ? 'Backing up…' : 'Backup to 0G Storage'}
          </button>
          ${journalBackup?.status === 'confirmed'
            ? `<a href="${journalBackup.explorerUrl}" target="_blank" rel="noreferrer" class="zerogBadge ok">${ICON.check}${journalBackup.rootHash.slice(0,10)}…</a>`
            : journalBackup?.status === 'failed'
              ? `<span class="zerogBadge fail">Failed</span>`
              : ''
          }
        </div>
      </div>`;
  }

  // ── Boot ──────────────────────────────────────────────────────────
  function init(){
    if(!window.ethers){
      console.warn('[0G] ethers.js not loaded — 0G Chain features disabled. Check the CDN <script> tag in index.html.');
    }
    buildUi();
    installHooks();
    // Some pages/tabs render after a delay — keep hooks fresh if the app
    // redefines these functions later during its own init sequence.
    setTimeout(installHooks, 1000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { connectWallet, backupJournal, onTradeClosed, openSpotOverlay };
})();
