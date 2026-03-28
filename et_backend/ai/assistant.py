"""
AI Market Copilot for SignalForge
----------------------------------
Premium, structured AI assistant for Indian stock market intelligence.
Supports OpenRouter, OpenAI, Gemini, and a rich offline fallback mode.

Integration points (unchanged):
  - get_assistant()          -> returns AIAssistant singleton
  - chat_with_assistant()    -> convenience async wrapper
  - assistant.chat()         -> returns structured dict (backward-compatible)
  - assistant.api_provider   -> read by router for logging
"""

import os
import re
import asyncio
import logging
from typing import Dict, List, Optional, Any

import requests
import openai
from dotenv import load_dotenv

from et_backend.data.fetcher import fetch_stock_data
from et_backend.signals.detector import detect_signal
from et_backend.context.context_engine import generate_full_context
from et_backend.scoring.scorer import calculate_signal_score
from et_backend.ai.explainer import AIExplainer

load_dotenv()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_API_TIMEOUT = 15  # seconds for external HTTP calls

_DEFAULT_SCAN_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "HINDUNILVR.NS",
    "ICICIBANK.NS", "KOTAKBANK.NS", "SBIN.NS", "BAJFINANCE.NS", "BHARTIARTL.NS",
]

_SECTOR_KEYWORDS: Dict[str, List[str]] = {
    "banking":  ["bank", "banking", "hdfc", "sbi", "icici", "kotak", "axis", "nifty bank"],
    "it":       ["it", "tech", "software", "tcs", "infosys", "wipro", "hcl", "tech mahindra"],
    "pharma":   ["pharma", "drug", "medicine", "sun pharma", "cipla", "dr reddy"],
    "energy":   ["energy", "oil", "gas", "ongc", "reliance", "bpcl", "ioc"],
    "fmcg":     ["fmcg", "consumer", "hindustan unilever", "itc", "nestle", "dabur"],
    "auto":     ["auto", "automobile", "car", "maruti", "tata motors", "bajaj auto", "hero"],
    "defense":  ["defense", "defence", "hal", "bhel", "bel", "drdo"],
    "realty":   ["realty", "real estate", "dlf", "godrej properties"],
    "metals":   ["metal", "steel", "tata steel", "jsw", "hindalco", "vedanta"],
}

_INTENT_PATTERNS: Dict[str, List[str]] = {
    "show_risky_stocks":   ["risky", "risk", "avoid", "danger", "bearish", "sell", "weak stocks", "downside"],
    "find_opportunities":  ["opportunit", "buy", "bullish", "breakout", "momentum", "upside", "gain", "find stocks"],
    "analyze_portfolio":   ["portfolio", "my holdings", "my stocks", "my position", "diversif", "allocation"],
    "market_overview":     ["market", "nifty", "sensex", "sector", "overview", "today", "trend", "broad market"],
    "compare_stocks":      ["compare", "vs", "versus", "better", "which is", "difference between"],
    "explain_concept":     ["what is", "explain", "how does", "define", "meaning of", "tell me about", "concept"],
    "stock_analysis":      [],  # fallback when symbols are detected
    "general_chat":        [],  # final fallback
}

# ---------------------------------------------------------------------------
# Helpers: intent classification & entity extraction
# ---------------------------------------------------------------------------

def _classify_intent(message: str, detected_symbols: List[str]) -> str:
    """
    Lightweight keyword-based intent classifier.
    Returns one of the intent keys defined in _INTENT_PATTERNS.
    """
    msg = message.lower()

    # explain_concept has highest priority when "what is / explain / how does" present
    # BUT if symbols are detected alongside "tell me about", treat as stock_analysis
    explain_triggers = ["what is", "what are", "explain", "how does", "how do", "define",
                        "meaning of", "what does"]
    about_triggers = ["tell me about", "tell me more about"]
    if any(t in msg for t in explain_triggers):
        return "explain_concept"
    if any(t in msg for t in about_triggers) and not detected_symbols:
        return "explain_concept"

    # compare_stocks
    if any(kw in msg for kw in _INTENT_PATTERNS["compare_stocks"]):
        return "compare_stocks"

    # portfolio
    if any(kw in msg for kw in _INTENT_PATTERNS["analyze_portfolio"]):
        return "analyze_portfolio"

    # risky stocks
    if any(kw in msg for kw in _INTENT_PATTERNS["show_risky_stocks"]):
        return "show_risky_stocks"

    # opportunities — only if "find/buy/opportunity" present, not just "momentum"
    opp_strong = ["opportunit", "find stocks", "buy signal", "best stocks", "top stocks"]
    if any(kw in msg for kw in opp_strong):
        return "find_opportunities"

    # market overview
    if any(kw in msg for kw in _INTENT_PATTERNS["market_overview"]):
        return "market_overview"

    # find_opportunities (broader — momentum/breakout/bullish without explain context)
    if any(kw in msg for kw in _INTENT_PATTERNS["find_opportunities"]):
        return "find_opportunities"

    # If explicit symbols were found -> stock_analysis
    if detected_symbols:
        return "stock_analysis"

    return "general_chat"


def _extract_symbols(message: str) -> List[str]:
    """
    Extract NSE stock symbols from a user message.
    Filters out common English words that match the uppercase pattern.
    """
    _NOISE = {
        # common English words
        "THE", "AND", "FOR", "ARE", "WITH", "FROM", "HAVE", "THIS", "THAT",
        "WILL", "YOUR", "WHAT", "WHEN", "WHERE", "HOW", "WHY", "WHICH", "WHO",
        "CAN", "MAY", "MIGHT", "SHOULD", "COULD", "WOULD", "MUST", "NOT",
        "BUT", "ALL", "ANY", "ITS", "OUR", "HAS", "HAD", "WAS", "BEEN",
        "SHOW", "FIND", "GIVE", "TELL", "HELP", "BEST", "GOOD", "HIGH",
        "LOW", "TOP", "NEW", "OLD", "BIG", "NOW", "YES", "NO",
        "IS", "IT", "IN", "AT", "BE", "DO", "GO", "IF", "ME", "MY", "OF",
        "ON", "OR", "SO", "TO", "UP", "US", "WE", "BY", "AN", "AS", "AM",
        "VS", "RE", "OK", "HI",
        # finance/market terms that aren't tickers
        "AI", "NSE", "BSE", "IPO", "ETF", "SIP", "EMI", "GDP", "RBI",
        "FII", "DII", "BANK", "BULL", "BEAR", "CALL", "CASH", "DEBT",
        "FUND", "GAIN", "GOLD", "HOLD", "LOSS", "LOAN", "RATE", "RISE",
        "SALE", "STOP", "TERM", "UNIT", "YIELD", "NIFTY",
        # query / sentence words
        "ABOUT", "ALSO", "JUST", "LIKE", "MAKE", "OVER", "SOME", "THAN",
        "THEM", "THEN", "THEY", "TIME", "VERY", "WELL", "WERE", "YEAR",
        "BOTH", "EACH", "EVEN", "EVER", "FULL", "KEEP", "KNOW", "LAST",
        "LESS", "LONG", "LOOK", "MADE", "MANY", "MEAN", "MOST", "MOVE",
        "MUCH", "NEED", "NEXT", "ONLY", "OPEN", "PART", "PAST", "PLAN",
        "REAL", "RISK", "SAME", "SELL", "SIDE", "STAY", "SUCH", "SURE",
        "TAKE", "TURN", "TYPE", "USED", "VIEW", "WANT", "WAYS", "WEEK",
        "WENT", "WHOM", "WIDE", "WISE", "WISH", "WORK", "ZERO",
        "BULLISH", "BEARISH", "COMPARE", "MARKET", "SECTOR", "STOCK",
        "PRICE", "TREND", "SIGNAL", "TODAY", "DAILY", "STRONG", "WEAK",
        "DOWN", "INTO", "UPON", "AWAY", "BACK", "EARLY", "EVERY", "FIRST",
        "GIVEN", "LARGE", "LATER", "NEVER", "OFTEN", "OTHER", "PLACE",
        "POINT", "QUITE", "RIGHT", "SINCE", "SMALL", "STILL", "THEIR",
        "THERE", "THESE", "THOSE", "THREE", "UNDER", "UNTIL", "USING",
        "VALUE", "WATCH", "WHILE", "WHOLE", "WITHIN", "WITHOUT", "RECENT",
        # words that appear in common queries but aren't tickers
        "RISKY", "STOCKS", "ANALYZE", "ANALYSIS", "SHOW", "LIST", "GET",
        "WHAT", "GIVE", "TELL", "FIND", "LOOK", "CHECK", "SCAN", "RUN",
        "OPPORTUNITIES", "OPPORTUNITY", "PORTFOLIO", "HOLDINGS", "POSITION",
        "OVERVIEW", "SUMMARY", "REPORT", "UPDATE", "NEWS", "INFO", "DATA",
        "CHART", "GRAPH", "COMPARE", "VERSUS", "BETWEEN", "AGAINST",
        "SECTOR", "SECTORS", "MARKET", "MARKETS", "INDEX", "INDICES",
        "NIFTY", "SENSEX", "MIDCAP", "SMALLCAP", "LARGECAP",
    }

    # Known Indian stock name -> symbol mapping (extend as needed)
    _NAME_MAP = {
        "reliance": "RELIANCE", "tcs": "TCS", "infosys": "INFY",
        "wipro": "WIPRO", "hdfc bank": "HDFCBANK", "hdfc": "HDFCBANK",
        "icici bank": "ICICIBANK", "icici": "ICICIBANK",
        "sbi": "SBIN", "state bank": "SBIN",
        "kotak": "KOTAKBANK", "bajaj finance": "BAJFINANCE",
        "bharti airtel": "BHARTIARTL", "airtel": "BHARTIARTL",
        "hindustan unilever": "HINDUNILVR", "hul": "HINDUNILVR",
        "sun pharma": "SUNPHARMA", "cipla": "CIPLA",
        "dr reddy": "DRREDDY", "ongc": "ONGC",
        "maruti": "MARUTI", "tata motors": "TATAMOTORS",
        "tata steel": "TATASTEEL", "jsw steel": "JSWSTEEL",
        "itc": "ITC", "nestle": "NESTLEIND",
        "adani ports": "ADANIPORTS", "adani": "ADANIPORTS",
        "ltimindtree": "LTIM", "hcl tech": "HCLTECH",
        "tech mahindra": "TECHM", "axis bank": "AXISBANK",
    }

    symbols: set = set()
    msg_lower = message.lower()

    # Match known names first (longest match wins)
    for name, sym in sorted(_NAME_MAP.items(), key=lambda x: -len(x[0])):
        if name in msg_lower:
            symbols.add(sym + ".NS")

    # Regex for explicit uppercase symbols / .NS suffixes
    for match in re.findall(r'\b([A-Z]{2,10}(?:\.NS)?)\b', message.upper()):
        base = match.replace(".NS", "")
        if base not in _NOISE and len(base) >= 2:
            symbols.add(base + ".NS")

    return list(symbols)


def _detect_sectors(message: str) -> List[str]:
    """Return sector names mentioned in the message."""
    msg = message.lower()
    return [sector for sector, kws in _SECTOR_KEYWORDS.items() if any(k in msg for k in kws)]


def _build_stock_card(
    symbol: str,
    data: Dict,
    signal_result: Dict,
    score_result: Dict,
    explanation: str,
) -> Dict:
    """Build a UI-ready stock card dict."""
    score = score_result.get("total_score", 0)
    signal = signal_result.get("signal_type", "Weak")
    trend = signal_result.get("trend", "unknown")

    risk_level = (
        "High" if score < 40 or signal == "Weak"
        else "Medium" if score < 65
        else "Low"
    )
    sentiment = (
        "Bearish" if trend in ("downtrend", "weak") and score < 45
        else "Bullish" if trend == "uptrend" and score >= 60
        else "Neutral"
    )

    return {
        "symbol": symbol.replace(".NS", ""),
        "price": round(data.get("current_price", 0), 2),
        "signal": signal,
        "confidence": int(score),
        "trend": trend,
        "risk_level": risk_level,
        "sentiment": sentiment,
        "reason": explanation,
        "explanation": explanation,
    }

# ---------------------------------------------------------------------------
# Helpers: follow-up prompts & summary generation
# ---------------------------------------------------------------------------

def _follow_up_prompts(intent: str, sectors: List[str]) -> List[str]:
    """Generate contextual follow-up prompt suggestions."""
    base = {
        "show_risky_stocks":  [
            "Which sectors are most at risk right now?",
            "Show me opportunities instead",
            "How do I hedge against these risks?",
        ],
        "find_opportunities": [
            "Which of these has the strongest momentum?",
            "Show me risky stocks to avoid",
            "Give me a market overview",
        ],
        "analyze_portfolio":  [
            "Which stocks in my portfolio are risky?",
            "How can I diversify better?",
            "Find new opportunities to add",
        ],
        "market_overview":    [
            "Show me today's top opportunities",
            "Which sectors are bullish?",
            "Show risky stocks to avoid",
        ],
        "stock_analysis":     [
            "Compare this with another stock",
            "What is the risk level?",
            "Show me similar opportunities",
        ],
        "compare_stocks":     [
            "Which has better momentum?",
            "Show full analysis for each",
            "What are the risks?",
        ],
        "explain_concept":    [
            "Show me a real example",
            "How does this apply to Indian markets?",
            "What signals should I watch?",
        ],
        "general_chat":       [
            "Show risky stocks today",
            "Find top opportunities",
            "Give me a market overview",
        ],
    }
    prompts = base.get(intent, base["general_chat"])
    if sectors:
        prompts.append(f"What's happening in the {sectors[0]} sector?")
    return prompts[:4]


def _build_summary(
    intent: str,
    all_cards: List[Dict],
    risky: List[Dict],
    opportunities: List[Dict],
) -> Dict:
    """Build the top-level summary block."""
    if not all_cards:
        return {
            "market_view": "Insufficient data for analysis",
            "confidence": 0,
            "risk_level": "Unknown",
            "sentiment": "Neutral",
        }

    avg_conf = int(sum(c["confidence"] for c in all_cards) / len(all_cards))
    bull_count = sum(1 for c in all_cards if c["sentiment"] == "Bullish")
    bear_count = sum(1 for c in all_cards if c["sentiment"] == "Bearish")

    if bull_count > bear_count:
        sentiment = "Bullish"
        market_view = f"{bull_count} of {len(all_cards)} scanned stocks show bullish signals."
    elif bear_count > bull_count:
        sentiment = "Bearish"
        market_view = f"{bear_count} of {len(all_cards)} scanned stocks show bearish or weak signals."
    else:
        sentiment = "Mixed"
        market_view = "Market signals are mixed. Selective opportunities exist."

    risk_level = "High" if len(risky) > len(opportunities) else "Medium" if risky else "Low"

    return {
        "market_view": market_view,
        "confidence": avg_conf,
        "risk_level": risk_level,
        "sentiment": sentiment,
    }

# ---------------------------------------------------------------------------
# Fallback response engine (no external API needed)
# ---------------------------------------------------------------------------

def _fallback_response(
    intent: str,
    message: str,
    all_cards: List[Dict],
    risky: List[Dict],
    opportunities: List[Dict],
    sectors: List[str],
) -> str:
    """
    Generate a structured, premium-quality response without any external API.
    Used when all providers fail or no keys are configured.
    """
    msg = message.lower()

    # --- intent: show_risky_stocks ---
    if intent == "show_risky_stocks":
        if risky:
            names = ", ".join(c["symbol"] for c in risky[:3])
            return (
                f"Based on current signal analysis, {names} are showing elevated risk. "
                f"These stocks exhibit weak momentum, low confidence scores, or bearish trend patterns. "
                f"Consider reducing exposure or setting tighter stop-losses on these positions."
            )
        return (
            "No strongly risky signals detected in the current scan. "
            "Markets appear relatively stable, though always monitor for sudden volume spikes or trend reversals."
        )

    # --- intent: find_opportunities ---
    if intent == "find_opportunities":
        if opportunities:
            names = ", ".join(c["symbol"] for c in opportunities[:3])
            return (
                f"Current signal analysis highlights {names} as potential opportunities. "
                f"These stocks show breakout or momentum signals with above-average confidence. "
                f"Always validate with your own research before acting."
            )
        return (
            "No high-conviction opportunities detected in the current scan. "
            "Markets may be in a consolidation phase. Watch for volume breakouts as entry signals."
        )

    # --- intent: analyze_portfolio ---
    if intent == "analyze_portfolio":
        return (
            "Portfolio analysis requires your holdings data. "
            "Key risk factors to review: sector concentration above 40%, "
            "positions with weak or bearish signals, and stocks with declining volume trends. "
            "Diversification across at least 4-5 sectors reduces single-sector risk significantly."
        )

    # --- intent: market_overview ---
    if intent == "market_overview":
        sector_note = f" The {sectors[0]} sector appears active." if sectors else ""
        if all_cards:
            bull = sum(1 for c in all_cards if c["sentiment"] == "Bullish")
            total = len(all_cards)
            return (
                f"Market scan across {total} stocks: {bull} showing bullish signals, "
                f"{total - bull} neutral or bearish.{sector_note} "
                f"Focus on high-confidence breakout and momentum signals for near-term opportunities."
            )
        return (
            f"Indian markets (NSE/BSE) are active.{sector_note} "
            f"Monitor Nifty 50 and Bank Nifty for broad direction. "
            f"FII/DII flows and RBI policy stance remain key macro drivers."
        )

    # --- intent: compare_stocks ---
    if intent == "compare_stocks" and len(all_cards) >= 2:
        a, b = all_cards[0], all_cards[1]
        winner = a if a["confidence"] >= b["confidence"] else b
        return (
            f"Comparing {a['symbol']} vs {b['symbol']}: "
            f"{a['symbol']} shows {a['signal']} signal ({a['confidence']}% confidence, {a['trend']} trend). "
            f"{b['symbol']} shows {b['signal']} signal ({b['confidence']}% confidence, {b['trend']} trend). "
            f"{winner['symbol']} currently has stronger signal conviction."
        )

    # --- intent: explain_concept ---
    if intent == "explain_concept":
        concepts = {
            "momentum": "Momentum investing focuses on stocks with strong recent price trends. "
                        "High volume combined with consistent upward closes signals strong momentum.",
            "breakout": "A breakout occurs when price moves decisively above a resistance level, "
                        "often with a volume spike confirming institutional participation.",
            "rsi":      "RSI (Relative Strength Index) measures overbought/oversold conditions. "
                        "Above 70 suggests overbought; below 30 suggests oversold.",
            "macd":     "MACD tracks trend direction and momentum. A bullish crossover (MACD above signal line) "
                        "often precedes upward price moves.",
            "support":  "Support is a price level where buying interest is strong enough to prevent further decline.",
            "resistance": "Resistance is a price level where selling pressure prevents further upside.",
        }
        for kw, explanation in concepts.items():
            if kw in msg:
                return explanation
        return (
            "I can explain technical analysis concepts like momentum, breakout, RSI, MACD, "
            "support/resistance, and more. Ask me about a specific concept for a detailed explanation."
        )

    # --- stock_analysis with data ---
    if intent == "stock_analysis" and all_cards:
        card = all_cards[0]
        return (
            f"{card['symbol']} is showing a {card['signal']} signal with {card['confidence']}% confidence. "
            f"Trend: {card['trend']}. Risk level: {card['risk_level']}. "
            f"{card['explanation']}"
        )

    # --- general fallback ---
    return (
        "I'm SignalForge AI, your market intelligence copilot. "
        "I can analyze stocks, identify opportunities, flag risky positions, "
        "explain market concepts, and give you a market overview. "
        "Try: 'Show risky stocks', 'Find opportunities', or ask about a specific ticker."
    )

# ---------------------------------------------------------------------------
# AIAssistant class
# ---------------------------------------------------------------------------

class AIAssistant:
    """
    Premium AI market copilot for SignalForge.

    Supports OpenRouter, OpenAI, Gemini, and a rich offline fallback.
    Startup-safe: provider failures never crash the backend.
    """

    def __init__(self):
        self.api_provider: str = "fallback"
        self.openrouter_key: Optional[str] = None
        self.gemini_key: Optional[str] = None
        self.openai_client: Optional[Any] = None
        self.explainer: Optional[AIExplainer] = None

        self._init_provider()
        self._init_explainer()

    # ------------------------------------------------------------------
    # Initialization (startup-safe)
    # ------------------------------------------------------------------

    def _init_provider(self) -> None:
        """Select and configure the best available AI provider."""
        try:
            if os.getenv("OPENROUTER_API_KEY"):
                self.openrouter_key = os.getenv("OPENROUTER_API_KEY")
                self.api_provider = "openrouter"
            elif os.getenv("OPENAI_API_KEY"):
                self.openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                self.api_provider = "openai"
            elif os.getenv("GEMINI_API_KEY"):
                self.gemini_key = os.getenv("GEMINI_API_KEY")
                self.api_provider = "gemini"
            else:
                self.api_provider = "fallback"
                logger.info("No AI API keys found — running in fallback mode.")
        except Exception as e:
            logger.warning(f"Provider init failed ({e}), using fallback.")
            self.api_provider = "fallback"

    def _init_explainer(self) -> None:
        try:
            self.explainer = AIExplainer()
        except Exception:
            self.explainer = None

    # ------------------------------------------------------------------
    # Stock analysis pipeline
    # ------------------------------------------------------------------

    async def _analyze_symbols(self, symbols: List[str]) -> List[Dict]:
        """
        Run the full signal pipeline on a list of symbols.
        Returns a list of UI-ready stock card dicts.
        """
        if not symbols:
            return []

        cards: List[Dict] = []
        try:
            loop = asyncio.get_event_loop()
            stock_data: Dict = await loop.run_in_executor(
                None, lambda: fetch_stock_data(symbols)
            )

            for symbol in symbols:
                raw = stock_data.get(symbol)
                if not raw or raw.get("error"):
                    continue
                try:
                    sig = detect_signal(raw)
                    ctx = generate_full_context(
                        sig["signal_type"],
                        raw.get("last_5_days_closes", []),
                        sig["price_change"],
                        sig["volume_spike"],
                    )
                    score = calculate_signal_score(
                        sig["price_change"],
                        raw.get("volume", 0),
                        sig["volume_spike"],
                        sig["trend"],
                        sig["signal_type"],
                    )
                    explanation = self._explain(symbol, sig, ctx, score)
                    cards.append(_build_stock_card(symbol, raw, sig, score, explanation))
                except Exception as e:
                    logger.debug(f"Signal pipeline error for {symbol}: {e}")
        except Exception as e:
            logger.warning(f"Stock fetch error: {e}")

        return cards

    def _explain(self, symbol: str, sig: Dict, ctx: str, score: Dict) -> str:
        """Generate a one-line explanation for a stock card."""
        sym = symbol.replace(".NS", "")
        conf = int(score.get("total_score", 0))
        if self.explainer:
            try:
                return self.explainer.generate_explanation(
                    sym, sig["signal_type"], ctx, conf
                )
            except Exception:
                pass
        return f"{sym} shows {sig['signal_type'].lower()} signal with {conf}% confidence. {ctx}"

    # ------------------------------------------------------------------
    # Prompt builders
    # ------------------------------------------------------------------

    def _system_prompt(self, intent: str, cards: List[Dict], sectors: List[str]) -> str:
        stock_block = ""
        if cards:
            lines = [
                f"- {c['symbol']}: {c['signal']} signal, {c['confidence']}% confidence, "
                f"{c['trend']} trend, risk={c['risk_level']}. {c['explanation']}"
                for c in cards[:6]
            ]
            stock_block = "\n\nLive Signal Data:\n" + "\n".join(lines)

        sector_note = f"\nUser is asking about: {', '.join(sectors)} sector(s)." if sectors else ""

        return (
            "You are SignalForge AI, a premium market intelligence copilot for Indian stocks (NSE/BSE). "
            "You are concise, analytical, and investor-friendly. "
            "You never give direct buy/sell advice. You explain signals, risks, and opportunities clearly. "
            "Respond in 3-5 sentences max. Be sharp and specific — avoid generic filler."
            f"{sector_note}{stock_block}"
        )

    def _user_prompt(self, message: str, intent: str) -> str:
        intent_hints = {
            "show_risky_stocks":  "Identify which stocks are risky and explain why briefly.",
            "find_opportunities": "Identify the strongest opportunities and explain the signal.",
            "analyze_portfolio":  "Summarize portfolio risk and highlight weak positions.",
            "market_overview":    "Give a concise market overview with sentiment and key themes.",
            "compare_stocks":     "Compare the stocks mentioned and state which has stronger conviction.",
            "explain_concept":    "Explain the concept clearly in 2-3 sentences with a practical example.",
            "stock_analysis":     "Analyze the mentioned stock(s) and summarize signal strength.",
            "general_chat":       "Answer helpfully and suggest what the user can explore next.",
        }
        hint = intent_hints.get(intent, "")
        return f"User: {message}\n\nInstruction: {hint}" if hint else f"User: {message}"

    # ------------------------------------------------------------------
    # Provider call wrappers (with timeout)
    # ------------------------------------------------------------------

    def _call_openrouter(self, system: str, user: str) -> str:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.openrouter_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": 400,
                "temperature": 0.6,
            },
            timeout=_API_TIMEOUT,
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip()
        raise RuntimeError(f"OpenRouter {resp.status_code}: {resp.text[:200]}")

    def _call_openai(self, system: str, user: str) -> str:
        resp = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=400,
            temperature=0.6,
            timeout=_API_TIMEOUT,
        )
        return resp.choices[0].message.content.strip()

    def _call_gemini(self, system: str, user: str) -> str:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
            f"?key={self.gemini_key}",
            json={
                "contents": [{"parts": [{"text": f"{system}\n\n{user}"}]}],
                "generationConfig": {"temperature": 0.6, "maxOutputTokens": 400},
            },
            timeout=_API_TIMEOUT,
        )
        if resp.status_code == 200:
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        raise RuntimeError(f"Gemini {resp.status_code}: {resp.text[:200]}")

    async def _generate_ai_response(self, system: str, user: str) -> str:
        """
        Try providers in priority order, fall back gracefully.
        Blocking HTTP calls are offloaded to a thread executor.
        """
        loop = asyncio.get_event_loop()
        order = []

        if self.api_provider == "openrouter" and self.openrouter_key:
            order.append(("openrouter", lambda: self._call_openrouter(system, user)))
        if self.openai_client:
            order.append(("openai", lambda: self._call_openai(system, user)))
        if self.gemini_key:
            order.append(("gemini", lambda: self._call_gemini(system, user)))

        for name, fn in order:
            try:
                text = await loop.run_in_executor(None, fn)
                if text:
                    return text
            except Exception as e:
                logger.warning(f"{name} provider failed: {e}")

        return ""  # signal to caller that all providers failed

    # ------------------------------------------------------------------
    # Specialized mode builders
    # ------------------------------------------------------------------

    def _partition_cards(self, cards: List[Dict]):
        """Split cards into risky and opportunity buckets."""
        risky = [
            c for c in cards
            if c["risk_level"] == "High"
            or c["signal"] == "Weak"
            or c["sentiment"] == "Bearish"
        ]
        opportunities = [
            c for c in cards
            if c["confidence"] >= 60
            and c["signal"] in ("Breakout", "Momentum")
            and c["sentiment"] in ("Bullish", "Neutral")
        ]
        # Sort: risky by ascending confidence, opportunities by descending
        risky.sort(key=lambda x: x["confidence"])
        opportunities.sort(key=lambda x: x["confidence"], reverse=True)
        return risky, opportunities

    def _portfolio_insights(self, cards: List[Dict]) -> List[Dict]:
        """Generate portfolio-level insight objects from analyzed holdings."""
        insights = []
        if not cards:
            return insights

        weak = [c for c in cards if c["signal"] == "Weak" or c["risk_level"] == "High"]
        if weak:
            insights.append({
                "type": "warning",
                "title": "Weak Holdings Detected",
                "detail": f"{', '.join(c['symbol'] for c in weak[:3])} show weak or bearish signals.",
                "action": "Review position sizing or set stop-losses.",
            })

        signals = [c["signal"] for c in cards]
        if signals.count("Weak") > len(cards) // 2:
            insights.append({
                "type": "risk",
                "title": "High Proportion of Weak Signals",
                "detail": "More than half your holdings show weak momentum.",
                "action": "Consider rotating into higher-conviction positions.",
            })

        bull_count = sum(1 for c in cards if c["sentiment"] == "Bullish")
        if bull_count >= len(cards) * 0.7:
            insights.append({
                "type": "positive",
                "title": "Strong Portfolio Momentum",
                "detail": f"{bull_count} of {len(cards)} holdings are bullish.",
                "action": "Maintain positions; watch for overbought conditions.",
            })

        return insights

    def _suggested_actions(self, intent: str, risky: List[Dict], opps: List[Dict]) -> List[str]:
        actions = []
        if risky:
            actions.append(f"Review stop-losses on {risky[0]['symbol']}")
        if opps:
            actions.append(f"Monitor {opps[0]['symbol']} for entry on volume confirmation")
        if intent == "analyze_portfolio":
            actions.append("Rebalance sector allocation if any sector exceeds 40%")
        if intent == "market_overview":
            actions.append("Track Nifty 50 support levels for broad market direction")
        return actions[:3]

    # ------------------------------------------------------------------
    # Main chat() method — the primary integration point
    # ------------------------------------------------------------------

    async def chat(
        self,
        message: str,
        user_id: Optional[str] = None,
        portfolio_symbols: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Process a user message and return a fully structured, UI-ready response.

        Backward-compatible keys: `response`, `related_stocks`
        New keys: `intent`, `summary`, `risky_stocks`, `opportunities`,
                  `portfolio_insights`, `suggested_actions`,
                  `follow_up_prompts`, `metadata`

        Args:
            message:           User's natural-language query
            user_id:           Optional user ID (for logging / context)
            portfolio_symbols: Optional list of user's portfolio symbols
                               (passed by router for portfolio intent)

        Returns:
            Structured dict ready for frontend rendering.
        """
        # 1. Entity extraction
        symbols = _extract_symbols(message)
        sectors = _detect_sectors(message)

        # 2. Intent classification
        intent = _classify_intent(message, symbols)

        # 3. Determine which symbols to analyze
        scan_symbols = symbols
        if intent == "show_risky_stocks" and not symbols:
            scan_symbols = _DEFAULT_SCAN_SYMBOLS
        elif intent == "find_opportunities" and not symbols:
            scan_symbols = _DEFAULT_SCAN_SYMBOLS
        elif intent == "market_overview" and not symbols:
            scan_symbols = _DEFAULT_SCAN_SYMBOLS[:6]
        elif intent == "analyze_portfolio":
            scan_symbols = portfolio_symbols or symbols or _DEFAULT_SCAN_SYMBOLS[:5]

        # 4. Run signal pipeline
        all_cards = await self._analyze_symbols(scan_symbols) if scan_symbols else []

        # 5. Partition into risky / opportunities
        risky, opportunities = self._partition_cards(all_cards)

        # 6. Build portfolio insights (only relevant for portfolio intent)
        p_insights = (
            self._portfolio_insights(all_cards)
            if intent == "analyze_portfolio"
            else []
        )

        # 7. Generate AI response text
        system = self._system_prompt(intent, all_cards, sectors)
        user_prompt = self._user_prompt(message, intent)

        ai_text = await self._generate_ai_response(system, user_prompt)
        fallback_used = not bool(ai_text)

        if fallback_used:
            ai_text = _fallback_response(
                intent, message, all_cards, risky, opportunities, sectors
            )

        # 8. Build summary
        summary = _build_summary(intent, all_cards, risky, opportunities)

        # 9. Assemble final response
        return {
            # --- backward-compatible keys ---
            "response": ai_text,
            "related_stocks": all_cards,          # full list for generic use
            # --- new structured keys ---
            "intent": intent,
            "summary": summary,
            "risky_stocks": risky[:5],
            "opportunities": opportunities[:5],
            "portfolio_insights": p_insights,
            "suggested_actions": self._suggested_actions(intent, risky, opportunities),
            "follow_up_prompts": _follow_up_prompts(intent, sectors),
            "metadata": {
                "provider_used": self.api_provider,
                "fallback_used": fallback_used,
                "symbols_analyzed": [c["symbol"] for c in all_cards],
                "intent_detected": intent,
                "sectors_detected": sectors,
            },
        }

    # ------------------------------------------------------------------
    # Legacy compatibility shims
    # ------------------------------------------------------------------

    def generate_fallback_response(self, message: str, context: Optional[Dict] = None) -> str:
        """Legacy shim — kept for any direct callers."""
        cards = []
        if context and context.get("stock_analysis"):
            cards = context["stock_analysis"]
        risky, opps = self._partition_cards(cards)
        intent = _classify_intent(message, _extract_symbols(message))
        return _fallback_response(intent, message, cards, risky, opps, [])

    async def generate_response(self, message: str, context: Optional[Dict] = None) -> str:
        """Legacy shim — kept for any direct callers."""
        cards = []
        if context and context.get("stock_analysis"):
            cards = context["stock_analysis"]
        system = self._system_prompt("general_chat", cards, [])
        user_p = self._user_prompt(message, "general_chat")
        text = await self._generate_ai_response(system, user_p)
        if not text:
            text = self.generate_fallback_response(message, context)
        return text

    async def generate_response_openrouter(self, message: str, context: Optional[Dict] = None) -> str:
        """Legacy shim."""
        return await self.generate_response(message, context)

    async def generate_response_openai(self, message: str, context: Optional[Dict] = None) -> str:
        """Legacy shim."""
        return await self.generate_response(message, context)

    async def generate_response_gemini(self, message: str, context: Optional[Dict] = None) -> str:
        """Legacy shim."""
        return await self.generate_response(message, context)


# ---------------------------------------------------------------------------
# Module-level singleton & convenience functions
# ---------------------------------------------------------------------------

_assistant_instance: Optional[AIAssistant] = None


def get_assistant() -> AIAssistant:
    """
    Return the module-level AIAssistant singleton.
    Always startup-safe — never raises.
    """
    global _assistant_instance
    if _assistant_instance is None:
        try:
            _assistant_instance = AIAssistant()
        except Exception as e:
            logger.error(f"AIAssistant init failed: {e}. Creating fallback instance.")
            inst = object.__new__(AIAssistant)
            inst.api_provider = "fallback"
            inst.openrouter_key = None
            inst.gemini_key = None
            inst.openai_client = None
            inst.explainer = None
            _assistant_instance = inst
    return _assistant_instance


async def chat_with_assistant(
    message: str,
    user_id: Optional[str] = None,
    portfolio_symbols: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Convenience async wrapper around get_assistant().chat().
    Always returns a valid structured dict — never raises.
    """
    try:
        assistant = get_assistant()
        return await assistant.chat(message, user_id, portfolio_symbols)
    except Exception as e:
        logger.error(f"chat_with_assistant error: {e}")
        return {
            "response": (
                "I'm having trouble processing your request right now. "
                "Try asking about a specific stock, sector, or market concept."
            ),
            "related_stocks": [],
            "intent": "general_chat",
            "summary": {"market_view": "Unavailable", "confidence": 0,
                        "risk_level": "Unknown", "sentiment": "Neutral"},
            "risky_stocks": [],
            "opportunities": [],
            "portfolio_insights": [],
            "suggested_actions": [],
            "follow_up_prompts": [
                "Show risky stocks today",
                "Find top opportunities",
                "Give me a market overview",
            ],
            "metadata": {
                "provider_used": "fallback",
                "fallback_used": True,
                "symbols_analyzed": [],
                "intent_detected": "general_chat",
                "sectors_detected": [],
            },
        }
