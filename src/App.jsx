import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { TrendingUp, Wallet, Activity, ArrowRightLeft, ShieldAlert } from 'lucide-react';

export default function App() {
  const [portfolio, setPortfolio] = useState({ cash_balance: 0, total_value: 0, positions: {} });
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to the Live Portfolio Stats
    const unsubPortfolio = onSnapshot(doc(db, "bot_stats", "live_portfolio"), (doc) => {
      if (doc.exists()) {
        setPortfolio(doc.data());
      }
    });

    // 2. Listen to the Trade History (Grabs the latest 50 trades)
    const q = query(collection(db, "trade_history"), orderBy("timestamp", "desc"), limit(50));
    const unsubTrades = onSnapshot(q, (snapshot) => {
      const tradeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrades(tradeData);
      setLoading(false);
    });

    return () => {
      unsubPortfolio();
      unsubTrades();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <Activity className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  // Animation variants for Framer Motion
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-12 text-slate-100 font-sans">
      
      {/* HEADER */}
      <motion.div initial="hidden" animate="visible" variants={cardVariants} className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Autonomous Engine
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            System Live & Trading
          </p>
        </div>
      </motion.div>

      {/* TOP METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <motion.div initial="hidden" animate="visible" variants={cardVariants} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-4 text-blue-400">
            <TrendingUp className="h-6 w-6" />
            <h2 className="text-lg font-semibold text-slate-300">Total Portfolio Value</h2>
          </div>
          <p className="text-4xl font-bold text-white">${portfolio.total_value?.toFixed(2) || '0.00'}</p>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={cardVariants} transition={{ delay: 0.1 }} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-4 text-emerald-400">
            <Wallet className="h-6 w-6" />
            <h2 className="text-lg font-semibold text-slate-300">Available Cash</h2>
          </div>
          <p className="text-4xl font-bold text-white">${portfolio.cash_balance?.toFixed(2) || '0.00'}</p>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={cardVariants} transition={{ delay: 0.2 }} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-4 text-purple-400">
            <ShieldAlert className="h-6 w-6" />
            <h2 className="text-lg font-semibold text-slate-300">Active Positions</h2>
          </div>
          <p className="text-4xl font-bold text-white">{Object.keys(portfolio.positions || {}).length}</p>
        </motion.div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: ACTIVE POSITIONS */}
        <motion.div initial="hidden" animate="visible" variants={cardVariants} transition={{ delay: 0.3 }} className="lg:col-span-1 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" /> Current Holdings
          </h3>
          
          <div className="space-y-4">
            {Object.keys(portfolio.positions || {}).length === 0 ? (
              <p className="text-slate-400 text-center py-10">No active positions. Waiting for signals...</p>
            ) : (
              Object.entries(portfolio.positions).map(([symbol, data]) => (
                <div key={symbol} className="p-4 bg-slate-900 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">{symbol}</p>
                    <p className="text-sm text-slate-400">Entry: ${data.entry_price?.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-400">{data.amount?.toFixed(4)}</p>
                    <p className="text-xs text-slate-500">Coins</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* RIGHT COLUMN: TRADE HISTORY */}
        <motion.div initial="hidden" animate="visible" variants={cardVariants} transition={{ delay: 0.4 }} className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl p-6 overflow-hidden">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-emerald-400" /> Recent Executions
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-3 px-4 font-medium">Time</th>
                  <th className="pb-3 px-4 font-medium">Symbol</th>
                  <th className="pb-3 px-4 font-medium">Action</th>
                  <th className="pb-3 px-4 font-medium text-right">Price</th>
                  <th className="pb-3 px-4 font-medium text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-slate-400">No trades executed yet.</td>
                  </tr>
                ) : (
                  trades.map((trade, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={trade.id} 
                      className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="py-4 px-4 text-sm text-slate-300">{trade.time}</td>
                      <td className="py-4 px-4 font-semibold">{trade.symbol}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 
                          trade.action === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {trade.action}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-sm">${trade.price?.toFixed(2)}</td>
                      <td className={`py-4 px-4 text-right font-mono text-sm ${trade.profit > 0 ? 'text-emerald-400' : trade.profit < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                        {trade.profit ? `$${trade.profit}` : '-'}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}