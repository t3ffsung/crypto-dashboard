import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { TrendingUp, Wallet, Activity, ArrowRightLeft, ShieldAlert, Crosshair } from 'lucide-react';

// Top 10 Volatile Trading Pairs
const TOP_COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "PEPEUSDT"];

export default function App() {
  const [portfolio, setPortfolio] = useState({ cash_balance: 0, total_value: 0, positions: {} });
  const [trades, setTrades] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to Firebase Portfolio
    const unsubPortfolio = onSnapshot(doc(db, "bot_stats", "live_portfolio"), (doc) => {
      if (doc.exists()) setPortfolio(doc.data());
    });

    // 2. Listen to Firebase Trade History
    const q = query(collection(db, "trade_history"), orderBy("timestamp", "desc"), limit(15));
    const unsubTrades = onSnapshot(q, (snapshot) => {
      setTrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 3. Fetch Live Binance Prices every 3 seconds
    const fetchPrices = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(TOP_COINS)}`);
        const data = await res.json();
        const priceMap = {};
        data.forEach(item => {
          // Format "BTCUSDT" back to "BTC/USDT" for our bot to read
          const formattedSymbol = item.symbol.replace("USDT", "/USDT");
          priceMap[formattedSymbol] = parseFloat(item.price);
        });
        setLivePrices(priceMap);
      } catch (e) {
        console.error("Price fetch error", e);
      }
    };
    
    fetchPrices();
    const priceInterval = setInterval(fetchPrices, 3000);

    return () => {
      unsubPortfolio();
      unsubTrades();
      clearInterval(priceInterval);
    };
  }, []);

  // MANUAL TRADE SENDER
  const executeManualTrade = async (symbol, action) => {
    if (!window.confirm(`Are you sure you want to manually ${action} ${symbol}?`)) return;
    
    try {
      await addDoc(collection(db, "pending_orders"), {
        symbol: symbol,
        action: action,
        timestamp: serverTimestamp()
      });
      alert(`⚡ Command Sent! The bot will execute the ${action} on the next cycle.`);
    } catch (e) {
      alert("Failed to send command to database.");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white"><Activity className="h-10 w-10 animate-spin text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-12 text-slate-100 font-sans">
      
      {/* HEADER */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Pro Trading Terminal
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Algo Engine Active & Override Ready
          </p>
        </div>
      </div>

      {/* TOP METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-4 text-blue-400"><TrendingUp className="h-6 w-6" /><h2 className="text-lg font-semibold text-slate-300">Total Value</h2></div>
          <p className="text-4xl font-bold text-white">${portfolio.total_value?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-4 text-emerald-400"><Wallet className="h-6 w-6" /><h2 className="text-lg font-semibold text-slate-300">Cash Balance</h2></div>
          <p className="text-4xl font-bold text-white">${portfolio.cash_balance?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-4 text-purple-400"><ShieldAlert className="h-6 w-6" /><h2 className="text-lg font-semibold text-slate-300">Positions</h2></div>
          <p className="text-4xl font-bold text-white">{Object.keys(portfolio.positions || {}).length}</p>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: LIVE MARKET & MANUAL TRADING */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-rose-400" /> Live Market & Execution
            </h3>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {Object.entries(livePrices).map(([symbol, price]) => {
                const isOwned = Object.keys(portfolio.positions || {}).includes(symbol);
                return (
                  <div key={symbol} className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-lg">{symbol.replace('/USDT', '')}</p>
                      <p className="font-mono text-emerald-400">${price > 10 ? price.toFixed(2) : price.toFixed(5)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => executeManualTrade(symbol, "BUY")}
                        disabled={isOwned}
                        className={`flex-1 py-2 rounded text-sm font-bold transition-all ${isOwned ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40'}`}
                      >
                        BUY
                      </button>
                      <button 
                        onClick={() => executeManualTrade(symbol, "SELL")}
                        disabled={!isOwned}
                        className={`flex-1 py-2 rounded text-sm font-bold transition-all ${!isOwned ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/40'}`}
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE POSITIONS & HISTORY */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Positions */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-blue-400" /> Active Holdings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(portfolio.positions || {}).length === 0 ? (
                <p className="text-slate-400 italic">No open positions.</p>
              ) : (
                Object.entries(portfolio.positions).map(([symbol, data]) => {
                  const currentPrice = livePrices[symbol];
                  const pnl = currentPrice ? ((currentPrice - data.entry_price) / data.entry_price * 100) : 0;
                  
                  return (
                    <div key={symbol} className="p-4 bg-slate-900 rounded-xl border border-slate-700 flex justify-between items-center">
                      <div>
                        <p className="font-bold">{symbol}</p>
                        <p className="text-xs text-slate-400">Entry: ${data.entry_price?.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                        </p>
                        <p className="text-xs text-slate-500">Vol: {data.amount?.toFixed(4)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Trade Ledger */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-emerald-400" /> Trade Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Symbol</th>
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-6 text-slate-500">Waiting for first execution...</td></tr>
                  ) : (
                    trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-slate-700/50">
                        <td className="py-3 text-sm text-slate-400">{trade.time}</td>
                        <td className="py-3 font-semibold">{trade.symbol}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {trade.action}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-sm">${trade.price?.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
