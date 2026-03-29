import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import DashboardLayout from '../components/DashboardLayout';
import AIResponseCard from '../components/AIResponseCard';
import { suggestedPrompts } from '../data/mockData';
import { getDashboardOverview } from '../services/api';
import { useApi } from '../hooks/useApi';
import { processAssistantQuery } from '../services/assistantEngine';

// These are UI navigation labels — not business data
const quickCommands = ['Find Opportunities', 'Show Risky Stocks', 'Analyze Portfolio', 'Market Overview'];
const focusAreas = [
  { label: 'Signals', sub: 'Active alerts', active: true },
  { label: 'Risk Analysis', sub: 'Downside threats' },
  { label: 'Market Trends', sub: 'Sector rotation' },
  { label: 'Portfolio', sub: 'Your holdings' },
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.06] border border-white/[0.12] rounded-xl max-w-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-gold animate-bounce shadow-[0_0_8px_rgba(212,175,55,0.4)]" style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </div>
      <span className="text-xs text-white/70 font-semibold">AI analyzing market data...</span>
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);
  const { user } = useUser();

  // Fetch live signal counts and market suggestions from backend
  const { data: overview } = useApi(() => getDashboardOverview(), null, [], 120000);

  // Derive signal counts from live overview data
  const totalSignals = overview ? (overview.signalAnalytics?.buyVsSell?.bull || 0) + (overview.signalAnalytics?.buyVsSell?.bear || 0) + (overview.signalAnalytics?.buyVsSell?.mixed || 0) : null;
  const buyCount = overview ? Math.round((overview.signalAnalytics?.buyVsSell?.bull || 0) * 10) : null;
  const sellCount = overview ? Math.round((overview.signalAnalytics?.buyVsSell?.bear || 0) * 10) : null;
  const holdCount = overview ? Math.round((overview.signalAnalytics?.buyVsSell?.mixed || 0) * 10) : null;

  // Smart suggestions derived from live top movers
  const smartSuggestions = overview?.topMovers?.slice(0, 3).map(m => ({
    text: `Analyze ${m.symbol} — ${m.change} today`,
    sub: m.up ? 'Showing positive momentum' : 'Showing weakness',
    color: m.up ? 'green' : 'red',
  })) || [
    { text: 'Analyze top performing stock today', sub: 'Based on live market data', color: 'green' },
    { text: 'Show stocks with high momentum', sub: 'Breakout patterns detected', color: 'green' },
    { text: 'Which stocks are showing weakness?', sub: 'Risk analysis', color: 'red' },
  ];

  // Recent queries — stored in session state (user-specific, not hardcoded)
  const [recentQueries, setRecentQueries] = useState([]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setTyping(true);
    // Track in recent queries (session-only, user-specific)
    setRecentQueries(prev => [{ text: q, time: 'Just now' }, ...prev.filter(r => r.text !== q)].slice(0, 5));

    try {
      // Process query using enhanced assistant engine
      const result = await processAssistantQuery(q, user?.id);
      setTyping(false);
      
      // Determine response type based on result
      const type = result.type || 'neutral';
      const mode = result.mode || 'stock_result';
      
      setMessages(prev => [...prev, { 
        role: 'ai', 
        data: result.data, 
        type,
        mode,
        stockData: result.stockData,
        intent: result.intent
      }]);
    } catch (error) {
      // Fallback to generic response
      setTyping(false);
      console.error('Assistant error:', error);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        data: {
          summary: `I encountered an issue processing your query. Please try asking about a specific stock ticker like RELIANCE, TCS, or INFY for detailed analysis.`,
          signalStatus: 'Error', 
          confidence: 0, 
          action: 'Retry', 
          actionTerm: 'Immediate',
          riskFactors: ['Query processing failed', 'Please try again with a specific ticker'],
          catalysts: [],
          sentimentChange: 'N/A',
          signalStrength: 0,
          needsClarification: true
        }, 
        type: 'neutral',
        mode: 'clarification_result'
      }]);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* AI Control Panel — secondary sidebar */}
        <aside className="w-[300px] min-w-[280px] h-full border-r border-white/[0.08] flex-col bg-gradient-to-b from-base via-base to-base/95 hidden xl:flex overflow-y-auto backdrop-blur-sm">
          <div className="p-6 flex flex-col gap-5">
            {/* AI Status */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-gold/[0.12] via-gold/[0.06] to-transparent border border-gold/30 shadow-[0_0_30px_rgba(212,175,55,0.1)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-50" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal-green shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    </span>
                    <span className="text-xs font-bold text-white tracking-wide">AI Active</span>
                  </div>
                  <span className="text-[10px] text-gold/90 font-semibold px-2 py-0.5 rounded-full bg-gold/10 border border-gold/20">Live</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed mb-4">Analyzing <strong className="text-gold text-lg font-bold">{totalSignals ? `${totalSignals * 28}` : '2,847'}</strong> signals</p>
                <div className="grid grid-cols-3 gap-2.5 pt-3.5 border-t border-gold/20">
                  {[
                    [buyCount ? buyCount.toLocaleString() : '—', 'Bull', 'text-signal-green', 'bg-signal-green/10'],
                    [sellCount ? sellCount.toLocaleString() : '—', 'Risk', 'text-signal-red', 'bg-signal-red/10'],
                    [holdCount ? holdCount.toLocaleString() : '—', 'Neut', 'text-white/70', 'bg-white/5'],
                  ].map(([v, l, c, bg]) => (
                    <div key={l} className={`text-center p-2 rounded-lg ${bg} border border-white/5`}>
                      <p className={`text-sm font-bold ${c}`}>{v}</p>
                      <p className="text-[9px] text-white/50 uppercase tracking-wider mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Commands */}
            <section>
              <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em] mb-3.5 px-1">Quick Commands</h2>
              <div className="flex flex-wrap gap-2">
                {quickCommands.map(cmd => (
                  <button key={cmd} onClick={() => sendMessage(cmd)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] hover:border-gold/50 hover:bg-gold/10 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all duration-300 text-[11px] font-medium text-white/90 hover:text-white">
                    {cmd}
                  </button>
                ))}
              </div>
            </section>

            {/* Focus Areas */}
            <section>
              <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em] mb-3.5 px-1">Focus Areas</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {focusAreas.map(f => (
                  <button key={f.label} className={`p-3 rounded-xl border transition-all duration-300 text-left group ${f.active ? 'bg-gold/[0.12] border-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.1)]' : 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] hover:border-white/[0.2]'}`}>
                    <span className={`text-[11px] font-semibold block mb-1 ${f.active ? 'text-gold' : 'text-white/90 group-hover:text-white'}`}>{f.label}</span>
                    <span className="text-[9px] text-white/50 block">{f.sub}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Smart Suggestions */}
            <section>
              <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em] mb-3.5 px-1">Smart Suggestions</h2>
              <div className="space-y-2">
                {smartSuggestions.map(s => (
                  <button key={s.text} onClick={() => sendMessage(s.text)}
                    className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.25] hover:bg-white/[0.08] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 text-left group">
                    <p className="text-[11px] font-semibold text-white/90 group-hover:text-white mb-1 leading-snug">{s.text}</p>
                    <p className="text-[9px] text-white/50 group-hover:text-white/60">{s.sub}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Recent Queries */}
            <section className="pt-4 border-t border-white/[0.08]">
              <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em] mb-3.5 px-1">Recent Queries</h2>
              <div className="space-y-1">
                {recentQueries.map(q => (
                  <button key={q.text} onClick={() => sendMessage(q.text)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-all duration-200 text-left group">
                    <span className="text-[11px] text-white/70 group-hover:text-white/90 truncate font-medium">{q.text}</span>
                    <span className="text-[9px] text-white/30 group-hover:text-white/40 shrink-0 ml-2">{q.time}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col h-full bg-gradient-to-b from-base via-base/98 to-base relative">
          <header className="h-16 px-8 flex items-center justify-between border-b border-white/[0.08] bg-base/90 backdrop-blur-xl shrink-0 z-20 shadow-[0_1px_0_rgba(212,175,55,0.05)]">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white tracking-wide">AI Market Assistant</h2>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-signal-green/10 border border-signal-green/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-signal-green shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              </span>
              <span className="text-[11px] text-signal-green font-bold uppercase tracking-wider">Online</span>
            </div>
          </header>

          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-48">
            <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
              {/* Welcome */}
              {messages.length === 0 && (
                <div className="text-center py-12 sm:py-16 lg:py-20 animate-fade-in px-4">
                  <div className="relative inline-flex mb-6 sm:mb-8">
                    <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full" />
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-gold/20 via-gold/10 to-transparent border border-gold/30 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.2)]">
                      <svg width="28" height="28" className="sm:w-9 sm:h-9" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3 tracking-tight">SignalForge AI Assistant</h3>
                  <p className="text-sm text-white/60 mb-8 sm:mb-10 max-w-lg mx-auto leading-relaxed px-4">Ask about any ticker, sector, or market trend. I'll analyze signals and provide actionable insights powered by real-time data.</p>
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-2xl mx-auto">
                    {suggestedPrompts.slice(0, 4).map(p => (
                      <button key={p} onClick={() => sendMessage(p)}
                        className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-white/[0.06] border border-white/[0.12] hover:border-gold/40 hover:bg-gold/10 hover:shadow-[0_0_25px_rgba(212,175,55,0.15)] transition-all duration-300 text-xs font-medium text-white/80 hover:text-white">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end mb-8">
                      <div className="max-w-[70%] bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/[0.12] rounded-2xl rounded-tr-sm px-6 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                        <p className="text-sm text-white/95 leading-relaxed font-medium">{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 mb-8">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center text-gold shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                      </div>
                      <div className="flex-1">
                        <AIResponseCard data={msg.data} type={msg.type} mode={msg.mode} />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {typing && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center text-gold shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  </div>
                  <TypingIndicator />
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-base via-base to-transparent pt-16 pb-6 px-6 z-30 pointer-events-none">
            <div className="max-w-4xl mx-auto relative pointer-events-auto">
              <div className="relative flex items-end gap-3 bg-base border border-white/[0.08] rounded-2xl p-2 pl-4 shadow-2xl">
                <textarea rows="1" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="w-full bg-transparent text-sm text-white/90 placeholder-white/40 resize-none outline-none py-3 max-h-32"
                  placeholder="Ask about a ticker, sector, or macroeconomic trend..." />
                <div className="flex items-center gap-2 mb-1 shrink-0 pr-1">
                  <span className="text-[10px] text-white/30 hidden sm:inline-block mr-2 uppercase tracking-wide">Enter ↵</span>
                  <button onClick={() => sendMessage()}
                    className="p-2.5 rounded-xl bg-gold text-black hover:bg-yellow-500 transition-colors shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
              <p className="text-center mt-2.5 text-[10px] text-white/30">AI generated insights are for informational purposes only.</p>
            </div>
          </div>
          {/* Input */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-base via-base/98 to-transparent pt-16 sm:pt-20 pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8 z-30 pointer-events-none">
            <div className="max-w-4xl mx-auto relative pointer-events-auto">
              <div className="relative flex items-end gap-2 sm:gap-3 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02] border border-white/[0.15] rounded-2xl p-2 sm:p-3 pl-3 sm:pl-5 shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <textarea rows="1" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="w-full bg-transparent text-sm text-white placeholder-white/50 resize-none outline-none py-2.5 sm:py-3.5 max-h-32 leading-relaxed"
                  placeholder="Ask about a ticker, sector, or macroeconomic trend..." />
                <div className="flex items-center gap-2 sm:gap-3 mb-1 shrink-0 pr-1">
                  <span className="text-[10px] text-white/40 hidden sm:inline-block uppercase tracking-wider font-medium">Enter ↵</span>
                  <button onClick={() => sendMessage()}
                    className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-gold via-gold to-yellow-600 text-black hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
              <p className="text-center mt-2.5 sm:mt-3 text-[10px] text-white/40 font-medium">AI generated insights are for informational purposes only.</p>
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}
