import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { Activity, ArrowRightLeft, ShieldAlert, Crosshair, TrendingUp, Wallet, CheckCircle2, BarChart3, PieChart as PieChartIcon, Download, Layers, LineChart, Coins, Target, TrendingDown, Sun, Moon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const OG_COINS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT", "MATICUSDT", "LTCUSDT", "LINKUSDT", "BCHUSDT", "TRXUSDT", "XLMUSDT", "ATOMUSDT", "XMRUSDT", "ETCUSDT", "ALGOUSDT", "VETUSDT", "FILUSDT"];
const VOLATILE_COINS = ["PEPEUSDT", "WIFUSDT", "FLOKIUSDT", "BONKUSDT", "SHIBUSDT", "AVAXUSDT", "NEARUSDT", "RNDRUSDT", "FETUSDT", "INJUSDT", "OPUSDT", "ARBUSDT", "SUIUSDT", "APTUSDT", "SEIUSDT", "TIAUSDT", "JUPUSDT", "ORDIUSDT", "RUNEUSDT", "BOMEUSDT"];

export default function App() {
  const [portfolio, setPortfolio] = useState({ cash_balance: 0, total_value: 0, positions: {}, total_fees_paid: 0 });
  const [trades, setTrades] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [activeSymbol, setActiveSymbol] = useState("BTCUSDT");
  const [orderInput, setOrderInput] = useState({ usdt: '', qty: '' });
  const [orderConfirm, setOrderConfirm] = useState(false);
  const [showFees, setShowFees] = useState(false);
  
  // THE NEW THEME ENGINE
  const [isDark, setIsDark] = useState(true);

  // Dynamic Theme Dictionary
  const t = {
    bg: isDark ? 'bg-slate-950' : 'bg-slate-100',
    panel: isDark ? 'bg-slate-900' : 'bg-white',
    border: isDark ? 'border-slate-800' : 'border-slate-200',
    borderSubtle: isDark ? 'border-slate-800/50' : 'border-slate-200/50',
    textTitle: isDark ? 'text-white' : 'text-slate-900',
    textMain: isDark ? 'text-slate-300' : 'text-slate-700',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    textSub: isDark ? 'text-slate-500' : 'text-slate-400',
    inputBg: isDark ? 'bg-slate-950' : 'bg-slate-50',
    hover: isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50',
    badgeBg: isDark ? 'bg-slate-950' : 'bg-slate-100',
    matrixBg: isDark ? 'bg-slate-950/50' : 'bg-slate-50/50',
    headerBg: isDark ? 'bg-slate-900/90' : 'bg-white/90',
    popoverBg: isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-300',
    tvTheme: isDark ? 'dark' : 'light'
  };

  useEffect(() => {
    const unsubPortfolio = onSnapshot(doc(db, "bot_stats", "live_portfolio"), (doc) => {
      if (doc.exists()) setPortfolio(doc.data());
    });

    const q = query(collection(db, "trade_history"), orderBy("timestamp", "desc"), limit(200));
    const unsubTrades = onSnapshot(q, (snapshot) => {
      setTrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const fetchPrices = async () => {
      try {
        const allCoins = [...OG_COINS, ...VOLATILE_COINS];
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(allCoins)}`);
        const data = await res.json();
        const priceMap = {};
        data.forEach(item => priceMap[item.symbol] = parseFloat(item.price));
        setLivePrices(priceMap);
      } catch (e) { console.error(e); }
    };
    
    fetchPrices();
    const priceInterval = setInterval(fetchPrices, 3000);
    return () => { unsubPortfolio(); unsubTrades(); clearInterval(priceInterval); };
  }, []);

  const handleOrderInputChange = (type, value) => {
    const price = livePrices[activeSymbol];
    if (!price || value === '') {
      setOrderInput({ usdt: '', qty: '' });
      return;
    }
    if (type === 'usdt') setOrderInput({ usdt: value, qty: (parseFloat(value) / price).toFixed(6) });
    else setOrderInput({ qty: value, usdt: (parseFloat(value) * price).toFixed(2) });
  };

  const executeTrade = async (action, overrideAmountCoin = null) => {
    let amountUsdt = parseFloat(orderInput.usdt || 0);
    let amountCoin = overrideAmountCoin !== null ? overrideAmountCoin : parseFloat(orderInput.qty || 0);
    
    if (action !== "CLOSE") {
        if (amountUsdt <= 0) return alert("Enter a valid amount!");
        if (amountUsdt > portfolio.cash_balance) return alert("Insufficient margin!");
    }
    
    if (!window.confirm(`EXECUTE ${action}:\nAmount: ${amountCoin.toFixed(4)} ${activeSymbol.replace('USDT','')}\nEst. Margin: $${amountUsdt.toFixed(2)}`)) return;
    
    try {
      await addDoc(collection(db, "pending_orders"), { 
          symbol: activeSymbol.replace('USDT', '/USDT'), 
          action, amount_usdt: amountUsdt, amount_coin: amountCoin, price: livePrices[activeSymbol], timestamp: serverTimestamp() 
      });
      setOrderInput({ usdt: '', qty: '' });
      setOrderConfirm(true);
      setTimeout(() => setOrderConfirm(false), 2000); 
    } catch (e) { alert("Database error."); }
  };

  const exportToCSV = () => {
    const headers = "Time,Symbol,Action,Qty,Price,Profit\n";
    const rows = trades.map(t => `${t.timestamp || ''},${t.symbol},${t.action},${t.amount},${t.price},${t.profit || 0}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Terminal_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  let totalLiveProfitUsd = 0;
  let totalMarginUsed = 0;
  
  const activeHoldingsData = Object.entries(portfolio.positions || {}).map(([symbol, data]) => {
    const lookupSymbol = symbol.replace('/', '');
    const currentPrice = livePrices[lookupSymbol];
    let margin = 0, value = 0, pnlPercentage = 0, pnlUsd = 0, isLong = true;

    if (currentPrice) {
        margin = data.amount * data.entry_price;
        value = data.amount * currentPrice;
        totalMarginUsed += margin;
        isLong = data.type === 'LONG' || !data.type;
        pnlUsd = isLong ? (value - margin) : (margin - value);
        pnlPercentage = isLong ? ((currentPrice - data.entry_price) / data.entry_price * 100) : ((data.entry_price - currentPrice) / data.entry_price * 100);
        totalLiveProfitUsd += pnlUsd;
    }
    return { symbol, lookupSymbol, data, currentPrice, isLong, pnlPercentage, pnlUsd };
  });

  const profitableHoldings = activeHoldingsData.filter(h => h.pnlUsd >= 0).sort((a, b) => b.pnlUsd - a.pnlUsd);
  const losingHoldings = activeHoldingsData.filter(h => h.pnlUsd < 0).sort((a, b) => a.pnlUsd - b.pnlUsd);
  
  const totalProfitZoneUsd = profitableHoldings.reduce((sum, h) => sum + h.pnlUsd, 0);
  const totalDrawdownZoneUsd = losingHoldings.reduce((sum, h) => sum + h.pnlUsd, 0);

  const realTimeTotalValue = (portfolio.cash_balance || 0) + totalMarginUsed + totalLiveProfitUsd;
  const lifetimeRealizedPnL = realTimeTotalValue - 30000.0;
  const totalFeesPaid = portfolio.total_fees_paid || 0;
  const grossPnL = lifetimeRealizedPnL + totalFeesPaid;
  
  const grossPnLPercent = ((grossPnL / 30000) * 100).toFixed(2);
  const feesPercent = ((totalFeesPaid / 30000) * 100).toFixed(2);
  const netPnLPercent = ((lifetimeRealizedPnL / 30000) * 100).toFixed(2);
  const livePnLAccountPercent = ((totalLiveProfitUsd / 30000) * 100).toFixed(2);

  const assetAccumulatedPnL = {};
  trades.forEach(trade => {
     if (!assetAccumulatedPnL[trade.symbol]) assetAccumulatedPnL[trade.symbol] = 0;
     if (trade.profit) assetAccumulatedPnL[trade.symbol] += trade.profit;
  });

  const closedTrades = trades.filter(t => t.action.includes('CLOSE'));
  const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
  const winRate = closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) : 0.0;

  const displayedCoins = Object.keys(livePrices).filter(symbol => {
    if (marketFilter === 'ALL') return true;
    if (marketFilter === 'OG') return OG_COINS.includes(symbol);
    if (marketFilter === 'VOLATILE') return VOLATILE_COINS.includes(symbol);
    return true;
  });

  const getAvatarColor = (char) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500'];
    return colors[char.charCodeAt(0) % colors.length];
  };

  const isActiveOwned = Object.keys(portfolio.positions || {}).includes(activeSymbol.replace('USDT', '/USDT'));

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-950 text-white"><Activity className="h-10 w-10 animate-spin text-emerald-500" /></div>;

  return (
    <div className={`min-h-screen ${t.bg} p-3 md:p-6 font-sans transition-colors duration-300`}>
      
      {/* CSS Injection for custom scrollbars and body background based on theme */}
      <style>{`
        body { background-color: ${isDark ? '#020617' : '#f1f5f9'}; transition: background-color 0.3s; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: ${isDark ? '#334155' : '#cbd5e1'}; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: ${isDark ? '#475569' : '#94a3b8'}; }
      `}</style>

      {/* HEADER WITH THEME TOGGLE */}
      <div className={`mb-4 md:mb-6 border-b ${t.border} pb-4 flex flex-row items-end justify-between gap-4`}>
        <div>
          <h1 className={`text-xl md:text-3xl font-black tracking-tight ${t.textTitle} flex items-center gap-2 md:gap-3 transition-colors`}>
            <Activity className="text-emerald-500 h-5 w-5 md:h-8 md:w-8" /> QUANTUM FUTURES
          </h1>
          <p className={`${t.textMuted} mt-1 md:mt-2 text-xs md:text-sm font-medium flex items-center gap-2`}>
              <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
              HFT Engine & Multi-Indicator AI Online
          </p>
        </div>
        
        {/* LIGHT/DARK MODE BUTTON */}
        <button 
          onClick={() => setIsDark(!isDark)} 
          className={`p-2.5 rounded-full flex items-center justify-center transition-all shadow-sm ${isDark ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          title="Toggle Theme"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      {/* TOP METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3 mb-4 md:mb-6">
        <div className={`${t.panel} p-3 md:p-4 rounded-xl border ${t.border} shadow-lg transition-colors`}>
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-emerald-500" /><h2 className={`text-[9px] md:text-[10px] font-bold ${t.textMuted} uppercase tracking-widest`}>Total Value</h2></div>
          <p className={`text-base md:text-xl font-black ${t.textTitle} transition-colors`}>${realTimeTotalValue.toFixed(2)}</p>
        </div>
        <div className={`${t.panel} p-3 md:p-4 rounded-xl border ${t.border} shadow-lg transition-colors`}>
          <div className="flex items-center gap-2 mb-1"><Wallet className="h-3 w-3 md:h-4 md:w-4 text-blue-500" /><h2 className={`text-[9px] md:text-[10px] font-bold ${t.textMuted} uppercase tracking-widest`}>Avail. Margin</h2></div>
          <p className={`text-base md:text-xl font-black ${t.textTitle} transition-colors`}>${portfolio.cash_balance?.toFixed(2) || '0.00'}</p>
        </div>
        <div className={`${t.panel} p-3 md:p-4 rounded-xl border ${t.border} shadow-lg hidden lg:block transition-colors`}>
          <div className="flex items-center gap-2 mb-1"><ShieldAlert className="h-3 w-3 md:h-4 md:w-4 text-amber-500" /><h2 className={`text-[9px] md:text-[10px] font-bold ${t.textMuted} uppercase tracking-widest`}>Positions</h2></div>
          <p className={`text-base md:text-xl font-black ${t.textTitle} transition-colors`}>{Object.keys(portfolio.positions || {}).length} <span className={`${t.textSub} text-xs md:text-sm font-normal`}>/ 30</span></p>
        </div>
        
        <div className={`${t.panel} p-3 md:p-4 rounded-xl border ${t.border} shadow-lg relative overflow-hidden transition-colors`}>
          <div className={`absolute top-0 right-0 w-1 h-full ${totalLiveProfitUsd >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <div className="flex items-center gap-2 mb-1"><BarChart3 className={`h-3 w-3 md:h-4 md:w-4 ${totalLiveProfitUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} /><h2 className={`text-[9px] md:text-[10px] font-bold ${t.textMuted} uppercase tracking-widest`}>Live PnL</h2></div>
          <div className="flex items-baseline gap-1.5 md:gap-2">
            <p className={`text-base md:text-xl font-black ${totalLiveProfitUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalLiveProfitUsd >= 0 ? '+' : ''}${totalLiveProfitUsd.toFixed(2)}
            </p>
            <span className={`text-[10px] md:text-xs font-bold ${totalLiveProfitUsd >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
              ({totalLiveProfitUsd >= 0 ? '+' : ''}{livePnLAccountPercent}%)
            </span>
          </div>
        </div>

        <div className="relative">
          <div 
            className={`${t.panel} p-3 md:p-4 rounded-xl border ${t.border} shadow-lg h-full cursor-pointer ${t.hover} transition-colors`}
            onClick={() => setShowFees(!showFees)}
          >
            <div className={`absolute top-0 right-0 w-1 h-full rounded-r-xl ${lifetimeRealizedPnL >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <div className="flex justify-between items-start mb-1">
               <div className="flex items-center gap-2"><Layers className={`h-3 w-3 md:h-4 md:w-4 ${lifetimeRealizedPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} /><h2 className={`text-[9px] md:text-[10px] font-bold ${t.textMuted} uppercase tracking-widest`}>Lifetime PnL</h2></div>
            </div>
            <div className="flex items-baseline gap-1.5 md:gap-2">
              <p className={`text-base md:text-xl font-black ${lifetimeRealizedPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                 {lifetimeRealizedPnL >= 0 ? '+' : ''}${lifetimeRealizedPnL.toFixed(2)}
              </p>
              <span className={`text-[10px] md:text-xs font-bold ${lifetimeRealizedPnL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                 ({lifetimeRealizedPnL >= 0 ? '+' : ''}{netPnLPercent}%)
              </span>
            </div>
          </div>

          {showFees && (
            <div className={`absolute top-full right-0 md:left-0 mt-2 w-[280px] ${t.popoverBg} backdrop-blur-md border rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] z-50 p-4 animate-in fade-in slide-in-from-top-2`}>
               <div className="flex justify-between items-center mb-3">
                 <span className={`text-[10px] ${t.textMuted} font-bold uppercase tracking-widest`}>PnL Breakdown</span>
                 <button onClick={(e) => {e.stopPropagation(); setShowFees(false);}} className={`${t.textMuted} hover:${t.textTitle}`}>&times;</button>
               </div>
               
               <div className="flex justify-between items-center text-[11px] md:text-xs mb-2">
                  <span className={`${t.textMain} font-medium tracking-wide`}>Gross Return:</span>
                  <div className="text-right">
                     <span className={`font-mono font-bold block ${grossPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{grossPnL >= 0 ? '+' : ''}${grossPnL.toFixed(2)}</span>
                     <span className={`text-[9px] block ${grossPnL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>{grossPnL >= 0 ? '+' : ''}{grossPnLPercent}%</span>
                  </div>
               </div>
               
               <div className="flex justify-between items-center text-[11px] md:text-xs mb-3">
                  <span className={`${t.textMain} font-medium tracking-wide`}>Exchange Fees:</span>
                  <div className="text-right">
                     <span className="font-mono font-bold text-rose-500 block">-${totalFeesPaid.toFixed(2)}</span>
                     <span className="text-[9px] text-rose-500/70 block">-{feesPercent}%</span>
                  </div>
               </div>
               
               <div className={`w-full h-px ${t.border} my-2`}></div>
               
               <div className="flex justify-between items-center text-sm md:text-base mt-2">
                  <span className={`${t.textTitle} font-bold tracking-wide`}>Net Profit:</span>
                  <div className="text-right">
                     <span className={`font-mono font-black block ${lifetimeRealizedPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{lifetimeRealizedPnL >= 0 ? '+' : ''}${lifetimeRealizedPnL.toFixed(2)}</span>
                     <span className={`text-[10px] font-bold block ${lifetimeRealizedPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{lifetimeRealizedPnL >= 0 ? '+' : ''}{netPnLPercent}%</span>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* SCANNER & CHART WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className={`lg:col-span-1 ${t.panel} rounded-xl border ${t.border} flex flex-col h-[300px] md:h-[450px] shadow-lg overflow-hidden transition-colors`}>
           <div className={`p-2 md:p-3 border-b ${t.border}`}>
             <div className={`flex ${t.badgeBg} rounded-lg p-1 border ${t.border}`}>
                {['ALL', 'OG', 'VOLATILE'].map(filter => (
                  <button 
                    key={filter} onClick={() => setMarketFilter(filter)}
                    className={`flex-1 py-1.5 rounded-md text-[9px] md:text-xs font-bold tracking-wider transition-all ${marketFilter === filter ? 'bg-emerald-500 text-white shadow-sm' : `${t.textMuted} hover:${t.textTitle}`}`}
                  >{filter}</button>
                ))}
             </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {displayedCoins.map((symbol) => {
                const cleanName = symbol.replace('USDT', '');
                const isActive = activeSymbol === symbol;
                const char = cleanName.charAt(0);
                
                return (
                  <div key={symbol} onClick={() => setActiveSymbol(symbol)} className={`flex justify-between items-center p-2 md:p-3 rounded-lg cursor-pointer transition-all ${isActive ? (isDark ? 'bg-slate-800' : 'bg-slate-100') + ' border-l-2 border-emerald-500' : `${t.hover} border-l-2 border-transparent`}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                       <div className={`h-6 w-6 md:h-8 md:w-8 rounded-full ${getAvatarColor(char)} flex items-center justify-center text-[10px] md:text-sm text-white font-black shadow-inner`}>{char}</div>
                       <div><p className={`font-black text-xs md:text-sm ${isActive ? t.textTitle : t.textMain} transition-colors`}>{cleanName}</p><p className={`text-[8px] md:text-[10px] ${t.textSub} uppercase`}>USDT</p></div>
                    </div>
                    <p className={`font-mono font-medium text-xs md:text-sm ${isActive ? 'text-emerald-500' : t.textMuted} transition-colors`}>${livePrices[symbol] > 10 ? livePrices[symbol]?.toFixed(2) : livePrices[symbol]?.toFixed(4)}</p>
                  </div>
                )
              })}
           </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
           <div className={`${t.panel} rounded-xl border ${t.border} p-1 h-[300px] md:h-[450px] shadow-lg transition-colors`}>
             <div className="w-full h-full rounded-lg overflow-hidden">
                <iframe src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${activeSymbol}&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=${t.tvTheme}&style=1&timezone=Etc%2FUTC`} width="100%" height="100%" frameBorder="0" allowFullScreen></iframe>
             </div>
           </div>
        </div>
      </div>

      {/* FULL WIDTH SPLIT MATRIX FOR ACTIVE HOLDINGS */}
      <div className={`${t.panel} rounded-xl border ${t.border} shadow-lg p-3 md:p-5 mb-4 md:mb-6 transition-colors`}>
        <h3 className={`text-[10px] md:text-xs font-bold ${t.textMuted} uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2`}><Wallet className="h-3 w-3 md:h-4 md:w-4 text-blue-500" /> Active Holdings Split-Matrix</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className={`flex flex-col border border-emerald-500/20 rounded-lg ${t.matrixBg} overflow-hidden h-[250px] md:h-[350px] transition-colors`}>
            <div className="bg-emerald-500/10 p-2 md:p-3 flex justify-between items-center px-3 md:px-4 text-[9px] md:text-[10px] font-bold text-emerald-500 uppercase tracking-widest border-b border-emerald-500/20">
               <span className="flex items-center gap-1 md:gap-2"><TrendingUp className="h-3 w-3" /> In Profit ({profitableHoldings.length})</span>
               <span className="text-[9px] md:text-xs bg-emerald-500/20 px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow-sm">+${totalProfitZoneUsd.toFixed(2)}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 custom-scrollbar pr-1 md:pr-2">
               {profitableHoldings.length === 0 ? <p className={`text-center ${t.textMuted} text-[10px] md:text-xs italic mt-10`}>No positions in profit.</p> : 
                 profitableHoldings.map((h) => (
                   <div key={h.symbol} onClick={() => setActiveSymbol(h.lookupSymbol)} className={`p-2 md:p-3 ${t.panel} rounded-lg border ${t.border} flex justify-between items-center cursor-pointer hover:border-emerald-500/50 transition-all group`}>
                     <div className="pl-1 md:pl-2">
                       <p className={`font-black text-xs md:text-sm ${t.textTitle} flex items-center gap-1.5 md:gap-2`}>
                          {h.symbol.replace('/USDT', '')} <span className={`text-[7px] md:text-[8px] px-1 md:px-1.5 py-0.5 rounded ${h.isLong ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>{h.isLong ? 'LONG' : 'SHORT'}</span>
                       </p>
                       <p className={`text-[9px] md:text-[11px] ${t.textSub} font-mono mt-0.5`}>In: ${h.data.entry_price?.toFixed(4)}</p>
                     </div>
                     <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 md:gap-2 mb-1">
                           <p className={`text-[8px] md:text-[10px] ${t.textSub} font-mono group-hover:${t.textMain}`}>Qty: {h.data.amount?.toFixed(4)}</p>
                           <span className="inline-block px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black bg-emerald-500/10 text-emerald-500">+{h.pnlPercentage.toFixed(2)}%</span>
                        </div>
                        <p className="text-[10px] md:text-xs font-mono font-black text-emerald-500">+${h.pnlUsd.toFixed(2)}</p>
                     </div>
                   </div>
                 ))
               }
            </div>
          </div>

          <div className={`flex flex-col border border-rose-500/20 rounded-lg ${t.matrixBg} overflow-hidden h-[250px] md:h-[350px] transition-colors`}>
            <div className="bg-rose-500/10 p-2 md:p-3 flex justify-between items-center px-3 md:px-4 text-[9px] md:text-[10px] font-bold text-rose-500 uppercase tracking-widest border-b border-rose-500/20">
               <span className="flex items-center gap-1 md:gap-2"><TrendingDown className="h-3 w-3" /> In Drawdown ({losingHoldings.length})</span>
               <span className="text-[9px] md:text-xs bg-rose-500/20 px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow-sm">-${Math.abs(totalDrawdownZoneUsd).toFixed(2)}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 custom-scrollbar pr-1 md:pr-2">
               {losingHoldings.length === 0 ? <p className={`text-center ${t.textMuted} text-[10px] md:text-xs italic mt-10`}>No positions in drawdown.</p> : 
                 losingHoldings.map((h) => (
                   <div key={h.symbol} onClick={() => setActiveSymbol(h.lookupSymbol)} className={`p-2 md:p-3 ${t.panel} rounded-lg border ${t.border} flex justify-between items-center cursor-pointer hover:border-rose-500/50 transition-all group`}>
                     <div className="pl-1 md:pl-2">
                       <p className={`font-black text-xs md:text-sm ${t.textTitle} flex items-center gap-1.5 md:gap-2`}>
                          {h.symbol.replace('/USDT', '')} <span className={`text-[7px] md:text-[8px] px-1 md:px-1.5 py-0.5 rounded ${h.isLong ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>{h.isLong ? 'LONG' : 'SHORT'}</span>
                       </p>
                       <p className={`text-[9px] md:text-[11px] ${t.textSub} font-mono mt-0.5`}>In: ${h.data.entry_price?.toFixed(4)}</p>
                     </div>
                     <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 md:gap-2 mb-1">
                           <p className={`text-[8px] md:text-[10px] ${t.textSub} font-mono group-hover:${t.textMain}`}>Qty: {h.data.amount?.toFixed(4)}</p>
                           <span className="inline-block px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black bg-rose-500/10 text-rose-500">{h.pnlPercentage.toFixed(2)}%</span>
                        </div>
                        <p className="text-[10px] md:text-xs font-mono font-black text-rose-500">-${Math.abs(h.pnlUsd).toFixed(2)}</p>
                     </div>
                   </div>
                 ))
               }
            </div>
          </div>
        </div>
      </div>

      {/* LOWER SECTION: ACCUMULATED PNL & IMMUTABLE LEDGER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className={`lg:col-span-1 ${t.panel} rounded-xl border ${t.border} shadow-lg p-3 md:p-5 overflow-hidden transition-colors`}>
          <div className="flex justify-between items-center mb-3 md:mb-4">
             <h3 className={`text-[10px] md:text-xs font-bold ${t.textMuted} uppercase tracking-widest flex items-center gap-2`}><Coins className="h-3 w-3 md:h-4 md:w-4 text-purple-500" /> Accumulated PnL</h3>
             <div className={`${t.badgeBg} border ${t.border} px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[9px] md:text-[10px] font-bold ${t.textMain} flex items-center gap-1 md:gap-1.5`}>
                <Target className="h-2.5 w-2.5 md:h-3 md:w-3 text-emerald-500" /> Win Rate: {winRate}%
             </div>
          </div>
          <div className="overflow-y-auto overflow-x-auto h-[250px] md:h-[400px] custom-scrollbar pr-1 md:pr-2">
            <table className="w-full text-left">
              <thead className={`sticky top-0 ${t.headerBg} backdrop-blur-md z-10 transition-colors`}>
                <tr className={`border-b ${t.border} ${t.textSub} text-[9px] md:text-[10px] uppercase tracking-wider`}>
                  <th className="pb-2 md:pb-3 font-bold">Asset</th>
                  <th className="pb-2 md:pb-3 pr-2 md:pr-4 font-bold text-right">Lifetime Profit/Loss</th>
                </tr>
              </thead>
              <tbody className="text-xs md:text-sm">
                {Object.keys(assetAccumulatedPnL).length === 0 ? <tr><td colSpan="2" className={`text-center py-6 md:py-8 ${t.textSub} text-[10px] md:text-xs`}>No closed trades yet.</td></tr> : 
                  Object.entries(assetAccumulatedPnL)
                    .sort(([,a], [,b]) => b - a)
                    .map(([symbol, profit]) => (
                    <tr key={symbol} className={`border-b ${t.borderSub} ${t.hover} transition-colors`}>
                      <td className={`py-2 md:py-3 font-bold ${t.textTitle} flex items-center gap-2 md:gap-3`}>
                        <div className={`h-4 w-4 md:h-5 md:w-5 rounded-full ${getAvatarColor(symbol.charAt(0))} flex items-center justify-center text-[8px] md:text-[10px] text-white font-black`}>{symbol.charAt(0)}</div>
                        {symbol.replace('/USDT', '')} <span className={`text-[8px] md:text-[10px] ${t.textSub} font-normal`}>USDT</span>
                      </td>
                      <td className={`py-2 md:py-3 pr-2 md:pr-4 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        <div className={`lg:col-span-2 ${t.panel} rounded-xl border ${t.border} shadow-lg p-3 md:p-5 overflow-hidden transition-colors`}>
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h3 className={`text-[10px] md:text-xs font-bold ${t.textMuted} uppercase tracking-widest flex items-center gap-2`}><ArrowRightLeft className="h-3 w-3 md:h-4 md:w-4 text-emerald-500" /> Immutable Ledger</h3>
            <button onClick={exportToCSV} className="flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 md:px-3 py-1 md:py-1.5 rounded hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">
              <Download className="h-2.5 w-2.5 md:h-3 md:w-3" /> EXPORT
            </button>
          </div>
          <div className={`overflow-y-auto overflow-x-auto h-[250px] md:h-[400px] custom-scrollbar border ${t.border} rounded-lg transition-colors`}>
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className={`sticky top-0 ${t.headerBg} backdrop-blur-sm z-10 transition-colors`}>
                <tr className={`border-b ${t.border} ${t.textSub} text-[9px] md:text-[10px] uppercase tracking-widest`}>
                  <th className="py-2 md:py-3 px-3 md:px-4 font-bold">Time</th>
                  <th className="py-2 md:py-3 px-3 md:px-4 font-bold">Asset</th>
                  <th className="py-2 md:py-3 px-3 md:px-4 font-bold text-center">Type</th>
                  <th className="py-2 md:py-3 px-3 md:px-4 font-bold text-right">Qty</th>
                  <th className="py-2 md:py-3 px-3 md:px-4 font-bold text-right">Price</th>
                  <th className="py-2 md:py-3 px-3 md:px-4 font-bold text-right">Realized PnL</th>
                </tr>
              </thead>
              <tbody className="text-xs md:text-sm font-medium">
                {trades.length === 0 ? <tr><td colSpan="6" className={`text-center py-8 md:py-10 ${t.textSub} text-[10px] md:text-xs italic`}>Awaiting execution data...</td></tr> : 
                  trades.map((trade) => {
                    const tradeTime = trade.timestamp ? new Date(trade.timestamp).toLocaleString([], {month:'short', day:'numeric', hour: '2-digit', minute:'2-digit'}) : "-";
                    const pnl = trade.profit || 0;
                    const isClose = trade.action.includes('CLOSE');
                    
                    let actionColor = isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-200 text-slate-600';
                    if (trade.action.includes('LONG')) actionColor = 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                    if (trade.action.includes('SHORT')) actionColor = 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20';
                    if (isClose) actionColor = 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20';

                    return (
                      <tr key={trade.id} className={`border-b ${t.borderSubtle} ${t.hover} transition-colors group`}>
                        <td className={`py-2 md:py-3 px-3 md:px-4 ${t.textSub} font-mono text-[9px] md:text-[11px] whitespace-nowrap group-hover:${t.textMain} transition-colors`}>{tradeTime}</td>
                        <td className={`py-2 md:py-3 px-3 md:px-4 font-bold ${t.textTitle} whitespace-nowrap`}>
                           {trade.symbol.replace('/USDT', '')} <span className={`text-[8px] md:text-[10px] ${t.textMuted} font-normal`}>USDT</span>
                        </td>
                        <td className="py-2 md:py-3 px-3 md:px-4 whitespace-nowrap text-center">
                           <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[8px] md:text-[9px] font-black tracking-widest uppercase shadow-sm ${actionColor}`}>
                              {trade.action}
                           </span>
                        </td>
                        <td className={`py-2 md:py-3 px-3 md:px-4 text-right font-mono ${t.textMain} whitespace-nowrap text-[10px] md:text-xs`}>{trade.amount?.toFixed(4)}</td>
                        <td className={`py-2 md:py-3 px-3 md:px-4 text-right font-mono ${t.textMain} whitespace-nowrap text-[10px] md:text-xs`}>${trade.price?.toFixed(4)}</td>
                        <td className={`py-2 md:py-3 px-3 md:px-4 text-right font-mono font-bold whitespace-nowrap text-[10px] md:text-xs ${isClose ? (pnl >= 0 ? 'text-emerald-500' : 'text-rose-500') : t.textSub}`}>
                           {isClose ? (pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`) : '---'}
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
