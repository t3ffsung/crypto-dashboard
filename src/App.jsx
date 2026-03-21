import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { Activity, ArrowRightLeft, ShieldAlert, Crosshair, TrendingUp, Wallet, CheckCircle2 } from 'lucide-react';

const TOP_COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "PEPEUSDT"];

export default function App() {
  const [portfolio, setPortfolio] = useState({ cash_balance: 0, total_value: 0, positions: {} });
  const [trades, setTrades] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [tradeAmounts, setTradeAmounts] = useState({});
  const [orderConfirm, setOrderConfirm] = useState(null);

  useEffect(() => {
    const unsubPortfolio = onSnapshot(doc(db, "bot_stats", "live_portfolio"), (doc) => {
      if (doc.exists()) setPortfolio(doc.data());
    });

    const q = query(collection(db, "trade_history"), orderBy("timestamp", "desc"), limit(20));
    const unsubTrades = onSnapshot(q, (snapshot) => {
      setTrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const fetchPrices = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(TOP_COINS)}`);
        const data = await res.json();
        const priceMap = {};
        data.forEach(item => priceMap[item.symbol.replace("USDT", "/USDT")] = parseFloat(item.price));
        setLivePrices(priceMap);
      } catch (e) {
        console.error(e);
      }
    };
    
    fetchPrices();
    const priceInterval = setInterval(fetchPrices, 3000);
    return () => { unsubPortfolio(); unsubTrades(); clearInterval(priceInterval); };
  }, []);

  const executeManualTrade = async (symbol, action) => {
    const amount = parseFloat(tradeAmounts[symbol]);
    if (!amount || amount <= 0) return alert("Enter a valid USDT amount!");
    if (action === "BUY" && amount > portfolio.cash_balance) return alert("Insufficient cash!");
    if (!window.confirm(`EXECUTE ${action}: $${amount} of ${symbol}?`)) return;
    
    try {
      await addDoc(collection(db, "pending_orders"), { symbol, action, amount_usdt: amount, timestamp: serverTimestamp() });
      setTradeAmounts({...tradeAmounts, [symbol]: ""});
      setOrderConfirm(symbol);
      setTimeout(() => setOrderConfirm(null), 3000); // Show checkmark for 3 seconds
    } catch (e) {
      alert("Database error.");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-950 text-white"><Activity className="h-10 w-10 animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-200 font-sans selection:bg-emerald-500/30">
      
      {/* HEADER */}
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <Activity className="text-emerald-500 h-8 w-8" /> QUANTUM TERMINAL
        </h1>
        <p className="text-slate-400 mt-2 text-sm font-medium flex items-center gap-2">
            <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            Algo Engine & Manual Override Online
        </p>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="h-5 w-5 text-emerald-500" /><h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Value</h2></div>
          <p className="text-3xl font-black text-white">${portfolio.total_value?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-3 mb-2"><Wallet className="h-5 w-5 text-blue-500" /><h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Purchasing Power</h2></div>
          <p className="text-3xl font-black text-white">${portfolio.cash_balance?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-3 mb-2"><ShieldAlert className="h-5 w-5 text-amber-500" /><h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Open Positions</h2></div>
          <p className="text-3xl font-black text-white">{Object.keys(portfolio.positions || {}).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COMMAND CENTER */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg p-5">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Crosshair className="h-4 w-4 text-rose-500" /> Execution Matrix</h3>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(livePrices).map(([symbol, price]) => {
                const isOwned = Object.keys(portfolio.positions || {}).includes(symbol);
                return (
                  <div key={symbol} className="p-4 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-end mb-3">
                      <p className="font-black text-lg text-white">{symbol.replace('/USDT', '')}</p>
                      <p className="font-mono text-emerald-400 font-medium">${price > 10 ? price.toFixed(2) : price.toFixed(5)}</p>
                    </div>
                    
                    {orderConfirm === symbol ? (
                       <div className="h-10 w-full bg-emerald-500/20 text-emerald-400 rounded flex items-center justify-center font-bold text-sm gap-2">
                         <CheckCircle2 className="h-4 w-4" /> Order Queued
                       </div>
                    ) : (
                      <div className="flex gap-2">
                        <input type="number" placeholder="$ USDT" value={tradeAmounts[symbol] || ''} onChange={(e) => setTradeAmounts({...tradeAmounts, [symbol]: e.target.value})} className="w-1/3 bg-slate-900 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-emerald-500" disabled={isOwned}/>
                        <button onClick={() => executeManualTrade(symbol, "BUY")} disabled={isOwned} className={`flex-1 rounded text-xs font-black tracking-wider transition-all ${isOwned ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}>BUY</button>
                        <button onClick={() => executeManualTrade(symbol, "SELL")} disabled={!isOwned} className={`flex-1 rounded text-xs font-black tracking-wider transition-all ${!isOwned ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-rose-500 text-white hover:bg-rose-400'}`}>SELL</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PORTFOLIO & LEDGER */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg p-5">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-500" /> Active Holdings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.keys(portfolio.positions || {}).length === 0 ? <p className="text-slate-500 text-sm">Awaiting capital deployment...</p> : 
                Object.entries(portfolio.positions).map(([symbol, data]) => {
                  const currentPrice = livePrices[symbol];
                  const pnl = currentPrice ? ((currentPrice - data.entry_price) / data.entry_price * 100) : 0;
                  const isProfit = pnl >= 0;
                  
                  return (
                    <div key={symbol} className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="font-black text-white">{symbol}</p>
                        <p className="text-xs text-slate-500 font-mono">In: ${data.entry_price?.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold mb-1 ${isProfit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {isProfit ? '+' : ''}{pnl.toFixed(2)}%
                        </span>
                        <p className="text-xs text-slate-500 font-mono">Vol: {data.amount?.toFixed(4)}</p>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg p-5">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-emerald-500" /> Immutable Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider"><th className="pb-3 font-bold">Timestamp</th><th className="pb-3 font-bold">Asset</th><th className="pb-3 font-bold">Type</th><th className="pb-3 font-bold text-right">Execution Price</th></tr></thead>
                <tbody className="text-sm">
                  {trades.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-600">No executions recorded.</td></tr> : 
                    trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 text-slate-400 font-mono text-xs">{new Date(trade.time).toLocaleTimeString()}</td>
                        <td className="py-3 font-bold text-white">{trade.symbol}</td>
                        <td className="py-3"><span className={`px-2 py-1 rounded text-[10px] font-black tracking-wider uppercase ${trade.action.includes('BUY') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{trade.action}</span></td>
                        <td className="py-3 text-right font-mono text-slate-300">${trade.price?.toFixed(2)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
