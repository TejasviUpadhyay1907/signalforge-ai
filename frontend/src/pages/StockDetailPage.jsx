import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import TopBar from '../components/TopBar';
import SignalBadge from '../components/SignalBadge';
import ConfidenceMeter from '../components/ConfidenceMeter';
import { getStockDetail } from '../data/mockData';

const timeframes = ['1D', '1W', '1M', '3M', '1Y'];

export default function StockDetailPage() {
  const { symbol } = useParams();
  const d = getStockDetail(symbol);
  const [tf, setTf] = useState('1M');
  const isBullish = d.signal.includes('Bullish') || d.signal === 'Strong Bull';
  const signalColor = isBullish ? 'emerald' : 'red';

  return (
    <DashboardLayout>
      <TopBar title="Analysis" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1440px] mx-auto space-y-6">
          {/* Breadcrumb */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Link to="/dashboard" className="hover:text-gray-300">Equities</Link>
              <span>›</span>
              <span className="text-gray-500">{d.sector}</span>
              <span>›</span>
              <span className="text-gray-300">{d.symbol}</span>
            </div>
          </div>

          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold text-white tracking-tight">{d.name}</h1>
                <span className="px-2.5 py-1 rounded bg-surface border border-surfaceBorder text-gray-400 font-mono text-lg">{d.symbol}</span>
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-semibold text-white">${d.price.toFixed(2)}</span>
                <div className={`flex items-center gap-1 font-medium px-2 py-0.5 rounded text-sm ${isBullish ? 'text-signal-green bg-signal-green/10' : 'text-signal-red bg-signal-red/10'}`}>
                  {isBullish ? '↑' : '↓'} {d.change >= 0 ? '+' : ''}{d.changeAmt?.toFixed(2)} ({d.change >= 0 ? '+' : ''}{d.change}%)
                </div>
                <span className="text-gray-500 text-xs ml-2">Market Open</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Primary Signal</span>
                <div className={`flex items-center gap-2 bg-gradient-to-r ${isBullish ? 'from-signal-green/20 border-signal-green/30' : 'from-signal-red/20 border-signal-red/30'} to-transparent border pl-3 pr-4 py-2 rounded-lg backdrop-blur-sm`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${isBullish ? 'bg-signal-green' : 'bg-signal-red'} animate-pulse`} />
                  <span className={`${isBullish ? 'text-signal-green' : 'text-signal-red'} font-bold text-lg tracking-wide uppercase`}>{d.signal}</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center bg-surface border border-surfaceBorder rounded-lg p-2 min-w-[100px]">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Confidence</span>
                <ConfidenceMeter value={d.confidence} size="ring" />
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left */}
            <div className="lg:col-span-8 space-y-6">
              {/* Metrics Bar */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between px-5 py-4 bg-white/[0.02] border-b border-surfaceBorder gap-4">
                  {[
                    { label: 'Volume', value: d.volume, sub: d.volumeChange, color: 'emerald' },
                    { label: 'RSI (14)', value: d.rsi, sub: 'Momentum zone', color: 'amber' },
                    { label: 'Momentum', value: d.momentum, sub: 'Trend intact', color: isBullish ? 'emerald' : 'red' },
                    { label: 'Volatility', value: d.volatility, sub: `${d.iv} IV`, color: 'blue' },
                  ].map(m => (
                    <div key={m.label} className="min-w-[90px]">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{m.label}</span>
                      <div className={`text-lg font-bold text-${m.color}-400 mt-0.5`}>{m.value}</div>
                      <span className="text-[9px] text-gray-500">{m.sub}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-emerald-400 font-medium">AI actively analyzing</span>
                      <span className="text-[9px] text-gray-500">Processing 2.4M data points</span>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="p-5 border-b border-surfaceBorder flex justify-between items-center bg-white/[0.01]">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
                    Price Action & Key Levels
                  </h2>
                  <div className="flex bg-base rounded-md p-1 border border-surfaceBorder">
                    {timeframes.map(t => (
                      <button key={t} onClick={() => setTf(t)}
                        className={`px-3 py-1 text-xs font-medium rounded transition-all ${t === tf ? 'bg-surface text-white border border-white/10' : 'text-gray-400 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="relative w-full h-[300px] p-6">
                  <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={isBullish ? '#10B981' : '#EF4444'} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={isBullish ? '#10B981' : '#EF4444'} stopOpacity="0" />
                      </linearGradient>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    <line x1="0" y1="220" x2="800" y2="220" stroke="#6B7280" strokeWidth="1" strokeDasharray="4,4" />
                    <line x1="0" y1="95" x2="800" y2="95" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4,4" />
                    {d.chartData && (
                      <>
                        <path d={d.chartData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ` L 800 300 L 0 300 Z`} fill="url(#areaGrad)" />
                        <path d={d.chartData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke={isBullish ? '#10B981' : '#EF4444'} strokeWidth="3" strokeLinecap="round" />
                        <circle cx={d.chartData[d.chartData.length - 1].x} cy={d.chartData[d.chartData.length - 1].y} r="5" fill={isBullish ? '#10B981' : '#EF4444'} stroke="#0A0A0A" strokeWidth="2" />
                      </>
                    )}
                  </svg>
                </div>
              </div>

              {/* Confidence Drivers */}
              <div className={`glass-card rounded-2xl p-5 border border-${signalColor}-500/20 bg-gradient-to-r from-${signalColor}-500/5 to-transparent`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-sm font-semibold text-${signalColor}-400 flex items-center gap-2`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                    Why this is High Confidence
                  </h3>
                  <span className={`px-2 py-0.5 rounded bg-${signalColor}-500/20 text-${signalColor}-400 text-xs font-medium`}>{d.confidence}% Match</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.confidenceDrivers?.map(driver => (
                    <span key={driver} className={`px-3 py-1.5 rounded-full bg-surface border border-${signalColor}-500/30 text-xs text-gray-300 flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-${signalColor}-500 animate-pulse`} />
                      {driver}
                    </span>
                  ))}
                </div>
              </div>

              {/* Context Insights */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                  Context Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {d.contextInsights?.map(ci => (
                    <div key={ci.title} className={`flex items-start gap-3 p-4 rounded-xl bg-surface/50 border border-surfaceBorder hover:bg-surface transition-all duration-300 hover:border-${ci.color}-500/30 group cursor-pointer`}>
                      <div className={`mt-0.5 w-7 h-7 rounded-lg bg-${ci.color}-500/10 flex items-center justify-center shrink-0 border border-${ci.color}-500/20`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-${ci.color}-400`}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-200">{ci.title}</h4>
                          <span className={`px-1.5 py-0.5 rounded bg-${ci.color === 'amber' || ci.color === 'purple' ? 'amber' : 'emerald'}-500/20 text-${ci.color === 'amber' || ci.color === 'purple' ? 'amber' : 'emerald'}-400 text-[10px] font-semibold`}>{ci.strength}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">{ci.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Analysis Conclusion */}
              <div className="glass-card rounded-2xl p-6 border-t-[3px] border-t-gold relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-gold/10 rounded-full blur-2xl" />
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Analysis Conclusion</h2>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />AI analyzing
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{d.conclusion}</h3>
                <p className="text-sm text-gray-300">{d.conclusionText}</p>
                <div className="grid grid-cols-2 gap-4 border-t border-surfaceBorder pt-4 mt-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Time Horizon</div>
                    <div className="text-sm font-semibold text-white">{d.timeHorizon}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Target Price</div>
                    <div className={`text-sm font-semibold ${isBullish ? 'text-signal-green' : 'text-signal-red'}`}>{d.targetPrice}</div>
                  </div>
                </div>
              </div>

              {/* AI Synthesis */}
              <div className="glass-card rounded-2xl p-5 border border-gold/20 bg-gradient-to-b from-gold/5 to-transparent">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center border border-gold/30">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gold">SignalForge AI Synthesis</h3>
                      <span className="text-[10px] text-gray-500">{d.confidence}% confidence match</span>
                    </div>
                  </div>
                </div>
                <div className="mb-4 p-3 rounded-lg bg-surface/50 border border-surfaceBorder">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Signal Summary</h4>
                  <p className="text-sm text-white leading-relaxed">{d.aiSummary}</p>
                </div>
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What this means</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{d.aiExplanation}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.confidenceDrivers?.map(driver => (
                    <span key={driver} className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5L20 7" /></svg>
                      {driver}
                    </span>
                  ))}
                </div>
              </div>

              {/* Signal Timeline */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  Signal Timeline
                </h3>
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-3 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-500 rounded-full" />
                  {d.timeline?.map(step => (
                    <div key={step.label} className="relative flex flex-col items-center gap-2 z-10">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        step.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' :
                        step.status === 'active' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse' :
                        'bg-surface border-2 border-emerald-500'
                      }`}>
                        {step.status === 'pending' ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> :
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
                      </div>
                      <span className="text-[10px] text-gray-400 text-center">{step.label}</span>
                      <span className={`text-[9px] ${step.status === 'active' ? 'text-amber-400' : 'text-emerald-400'}`}>{step.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk / Reward */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  Risk / Reward Analysis
                </h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] text-gray-500 uppercase tracking-wider">Risk Level</span>
                      <span className="text-xs font-semibold text-amber-400">Medium ({d.risk?.level}%)</span>
                    </div>
                    <div className="h-3 bg-surface rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-amber-400/20 to-red-500/20" />
                      <div className="h-full rounded-full relative overflow-hidden" style={{ width: `${d.risk?.level}%` }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] text-gray-500 uppercase tracking-wider">Reward Potential</span>
                      <span className="text-xs font-semibold text-emerald-400">+5.2% to {d.targetPrice}</span>
                    </div>
                    <div className="h-3 bg-surface rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full" style={{ width: `${d.risk?.reward}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-surfaceBorder">
                    <div>
                      <span className="text-xs text-gray-400">Risk/Reward Ratio</span>
                      <div className="text-[10px] text-gray-500">Risk {d.risk?.riskAmt} → Reward {d.risk?.rewardAmt}</div>
                    </div>
                    <span className="text-2xl font-bold text-emerald-400">{d.risk?.ratio}</span>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              <div className="glass-card rounded-2xl p-6 border-l-4 border-l-signal-red bg-gradient-to-r from-signal-red/5 to-transparent">
                <h3 className="text-sm font-semibold text-signal-red mb-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                  What could go wrong
                </h3>
                <ul className="text-sm text-gray-300 space-y-2 list-disc pl-4 marker:text-gray-600">
                  {d.warnings?.map(w => (
                    <li key={w.title}><strong className="text-white font-medium">{w.title}:</strong> {w.text}</li>
                  ))}
                </ul>
              </div>

              {/* Action */}
              <div className="bg-surface rounded-2xl p-6 border border-surfaceBorder relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-surface to-emerald-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 flex flex-col items-center text-center">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Recommended Action</span>
                  <h2 className="text-3xl font-bold text-white mb-4">{isBullish ? 'Consider Entry' : 'Avoid / Hedge'}</h2>
                  <div className="w-full grid grid-cols-2 gap-3 mb-4 text-left">
                    <div className="bg-base p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase">Suggested Entry</div>
                      <div className="text-white font-medium">{d.risk?.entry}</div>
                    </div>
                    <div className="bg-base p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase">Stop Loss</div>
                      <div className="text-signal-red font-medium">{d.risk?.stopLoss}</div>
                    </div>
                  </div>
                  <button className={`w-full py-3.5 px-4 ${isBullish ? 'bg-signal-green hover:bg-emerald-400' : 'bg-signal-red hover:bg-red-400'} text-base font-bold rounded-xl transition-all flex items-center justify-center gap-2`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    Setup Trade Alert
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
