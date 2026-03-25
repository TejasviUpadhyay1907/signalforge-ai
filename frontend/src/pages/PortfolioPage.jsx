import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import TopBar from '../components/TopBar';
import SignalBadge from '../components/SignalBadge';
import MiniSparkline from '../components/MiniSparkline';
import Modal from '../components/Modal';
import { portfolios } from '../data/mockData';

const portfolioNames = Object.keys(portfolios);

export default function PortfolioPage() {
  const [selected, setSelected] = useState(portfolioNames[0]);
  const [showModal, setShowModal] = useState(false);
  const [newStock, setNewStock] = useState({ name: '', qty: '' });
  const [localHoldings, setLocalHoldings] = useState({});

  const p = portfolios[selected];
  const holdings = [...p.holdings, ...(localHoldings[selected] || [])];

  const addStock = () => {
    if (!newStock.name || !newStock.qty) return;
    const entry = {
      symbol: newStock.name.toUpperCase().slice(0, 4),
      name: newStock.name,
      price: (Math.random() * 300 + 50).toFixed(2) * 1,
      shares: parseInt(newStock.qty),
      signal: 'Neutral', confidence: 60, risk: 'Medium', change: (Math.random() * 4 - 2).toFixed(2) * 1,
    };
    setLocalHoldings(prev => ({ ...prev, [selected]: [...(prev[selected] || []), entry] }));
    setNewStock({ name: '', qty: '' });
    setShowModal(false);
  };

  return (
    <DashboardLayout>
      <TopBar title="Portfolio Analysis" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-sm text-white font-medium">SignalForge AI</div>
              <div className="text-base font-normal text-gray-400">Portfolio Analysis</div>
            </div>
            <div className="flex items-center gap-3">
              <select value={selected} onChange={e => setSelected(e.target.value)}
                className="bg-surface border border-surfaceBorder rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/50">
                {portfolioNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/[0.08] border border-purple-500/15">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <span className="text-xs text-purple-400 font-medium">AI Active</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Total Value</span>
                <span className="live-dot" />
              </div>
              <div className="text-2xl font-light text-white tabular-nums">${p.totalValue.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">USD</div>
            </div>
            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-2">Daily Change</span>
              <div className={`text-2xl font-light tabular-nums ${p.dailyChange >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                {p.dailyChange >= 0 ? '+' : ''}{p.dailyChange}%
              </div>
              <div className={`text-xs mt-1 ${p.dailyChange >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                {p.dailyChange >= 0 ? '+' : ''}${Math.abs(p.dailyChangeAmt).toLocaleString()} Today
              </div>
            </div>
            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-2">Health Score</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-light text-white">{p.healthScore}</span>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
              <div className="w-full h-1 bg-surfaceBorder rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-signal-green to-blue-500 rounded-full transition-all duration-1000" style={{ width: `${p.healthScore}%` }} />
              </div>
            </div>
            <div className="glass-card rounded-xl p-5 hover:-translate-y-0.5 transition-all">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-2">Overall Risk</span>
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  p.riskLevel === 'Low' ? 'bg-signal-greenLight text-signal-green border border-signal-green/20' :
                  p.riskLevel === 'Medium' ? 'bg-signal-amberLight text-signal-amber border border-signal-amber/20' :
                  'bg-signal-redLight text-signal-red border border-signal-red/20'
                }`}>{p.riskLevel} Exposure</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">Beta: {p.beta} • Volatility: {p.volatility}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left */}
            <div className="lg:col-span-2 space-y-6">
              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <span className="text-sm font-medium text-white block mb-3">Performance Trend</span>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={p.trendData}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="url(#colorVal)" strokeWidth={2} />
                      <Area type="monotone" dataKey="benchmark" stroke="#8e7cc3" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <span className="text-sm font-medium text-white block mb-3">Risk Distribution</span>
                  <div className="space-y-3 mt-4">
                    {Object.entries(p.riskDistribution).map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                          <span className="capitalize">{k} Risk ({v}%)</span>
                          <span>${((p.totalValue * v) / 100 / 1000).toFixed(1)}k</span>
                        </div>
                        <div className="w-full h-1 bg-surfaceBorder rounded-full">
                          <div className={`h-full rounded-full ${k === 'low' ? 'bg-signal-green' : k === 'medium' ? 'bg-signal-amber' : 'bg-signal-red'}`} style={{ width: `${v}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Holdings Table */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-surfaceBorder flex justify-between items-center">
                  <span className="text-sm font-medium text-white">Active Holdings</span>
                  <button onClick={() => setShowModal(true)} className="text-xs px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors">
                    + Add Stock
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-surfaceBorder">
                        <th className="px-5 py-3 font-normal">Asset</th>
                        <th className="px-3 py-3 font-normal">Price</th>
                        <th className="px-3 py-3 font-normal">Signal</th>
                        <th className="px-3 py-3 font-normal">Confidence</th>
                        <th className="px-3 py-3 font-normal">Risk</th>
                        <th className="px-3 py-3 font-normal">Trend</th>
                        <th className="px-3 py-3 font-normal text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map(h => (
                        <tr key={h.symbol} className="border-b border-surfaceBorder hover:bg-white/[0.02] transition-all">
                          <td className="px-5 py-3">
                            <span className="text-white font-medium">{h.name}</span>
                            <span className="text-gray-500 text-[11px] ml-1.5">{h.symbol}</span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">${h.price.toFixed(2)}</td>
                          <td className="px-3 py-3"><SignalBadge signal={h.signal} /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1 bg-surfaceBorder rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${h.confidence >= 80 ? 'bg-signal-green' : h.confidence >= 60 ? 'bg-signal-amber' : 'bg-signal-red'}`} style={{ width: `${h.confidence}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-500">{h.confidence}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs">{h.risk}</td>
                          <td className="px-3 py-3"><MiniSparkline trend={h.change >= 0 ? 'up' : 'down'} /></td>
                          <td className="px-3 py-3 text-right">
                            <Link to={`/stock/${h.symbol}`} className="text-[11px] px-3 py-1.5 rounded-md bg-white/5 border border-surfaceBorder text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                              Analyze
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right - AI Insights */}
            <div className="space-y-6">
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e7cc3" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                  <span className="text-sm font-medium text-white">SignalForge AI Analysis</span>
                </div>
                <div className="p-4 bg-purple-500/5 border border-purple-500/15 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e7cc3" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                    <span className="text-[11px] uppercase tracking-wider text-purple-400 font-medium">Portfolio Summary</span>
                  </div>
                  <p className="text-sm text-white leading-relaxed">
                    Overall stance is <span className="text-purple-400 font-medium">moderately bullish</span>. Strong momentum in semiconductor holdings is offsetting drag from consumer discretionary.
                  </p>
                </div>

                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-3">Key Insights</div>
                <div className="space-y-0">
                  {p.insights.map(ins => (
                    <div key={ins.title} className="py-3 border-b border-surfaceBorder last:border-0">
                      <div className="flex items-start gap-2.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" className="mt-0.5 shrink-0"
                          stroke={ins.type === 'warning' ? '#F59E0B' : ins.type === 'negative' ? '#DC2626' : ins.type === 'positive' ? '#16A34A' : '#6B7280'}>
                          {ins.type === 'warning' && <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>}
                          {ins.type === 'negative' && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>}
                          {ins.type === 'positive' && <><path d="M7 17l9.2-9.2M17 17V7H7" /></>}
                          {ins.type === 'neutral' && <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>}
                        </svg>
                        <div>
                          <div className="flex items-center flex-wrap gap-1.5">
                            <strong className="text-white font-medium text-[13px]">{ins.title}</strong>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              ins.type === 'warning' ? 'bg-signal-amberLight text-signal-amber' :
                              ins.type === 'negative' ? 'bg-signal-redLight text-signal-red' :
                              ins.type === 'positive' ? 'bg-signal-greenLight text-signal-green' :
                              'bg-white/5 text-gray-500'
                            }`}>{ins.confidence}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ins.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Suggested Actions */}
          <div>
            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-3">Suggested Actions</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {p.actions.map(a => (
                <div key={a.title} className="glass-card rounded-xl p-5 cursor-pointer hover:-translate-y-0.5 hover:border-blue-500/30 transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[13px] font-medium text-white flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" className={`text-${a.color === 'blue' ? 'blue' : a.color === 'orange' ? 'amber' : 'emerald'}-400`} stroke="currentColor">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5" />
                      </svg>
                      {a.title}
                    </h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider ${
                      a.impact === 'High' ? 'bg-signal-redLight text-signal-red' :
                      a.impact === 'Medium' ? 'bg-signal-amberLight text-signal-amber' :
                      'bg-signal-greenLight text-signal-green'
                    }`}>{a.impact} Impact</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{a.text}</p>
                  <div className="mt-3 pt-3 border-t border-surfaceBorder flex justify-between text-[11px]">
                    <span className="text-gray-500">Expected Outcome:</span>
                    <span className={`font-medium text-${a.color === 'blue' ? 'blue' : a.color === 'orange' ? 'amber' : 'emerald'}-400`}>{a.outcome}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Add Stock Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Stock to Portfolio">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Stock Name / Ticker</label>
            <input type="text" value={newStock.name} onChange={e => setNewStock(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-surface border border-surfaceBorder rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/50" placeholder="e.g. GOOGL" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Quantity</label>
            <input type="number" value={newStock.qty} onChange={e => setNewStock(p => ({ ...p, qty: e.target.value }))}
              className="w-full bg-surface border border-surfaceBorder rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold/50" placeholder="e.g. 100" />
          </div>
          <button onClick={addStock}
            className="w-full py-2.5 bg-gold hover:bg-gold-hover text-base font-semibold rounded-xl transition-all">
            Add to Portfolio
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
