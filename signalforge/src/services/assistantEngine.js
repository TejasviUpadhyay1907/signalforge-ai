/**
 * AI Assistant Engine
 * Handles query parsing, ticker resolution, data fetching, and analysis generation
 */

import { getStockDetail, getLiveQuotes, scanMarket } from './api';

// Comprehensive ticker/company name mapping for Indian stocks
const TICKER_MAP = {
  // Major stocks
  'reliance': 'RELIANCE',
  'reliance industries': 'RELIANCE',
  'ril': 'RELIANCE',
  'tcs': 'TCS',
  'tata consultancy': 'TCS',
  'tata consultancy services': 'TCS',
  'infosys': 'INFY',
  'infy': 'INFY',
  'wipro': 'WIPRO',
  'hdfc bank': 'HDFCBANK',
  'hdfcbank': 'HDFCBANK',
  'hdfc': 'HDFCBANK',
  'icici bank': 'ICICIBANK',
  'icicibank': 'ICICIBANK',
  'icici': 'ICICIBANK',
  'sbi': 'SBIN',
  'state bank': 'SBIN',
  'state bank of india': 'SBIN',
  'kotak': 'KOTAKBANK',
  'kotak bank': 'KOTAKBANK',
  'kotak mahindra': 'KOTAKBANK',
  'axis bank': 'AXISBANK',
  'axis': 'AXISBANK',
  'bajaj finance': 'BAJFINANCE',
  'bajaj': 'BAJFINANCE',
  'bharti airtel': 'BHARTIARTL',
  'airtel': 'BHARTIARTL',
  'bharti': 'BHARTIARTL',
  'itc': 'ITC',
  'hindustan unilever': 'HINDUNILVR',
  'hul': 'HINDUNILVR',
  'unilever': 'HINDUNILVR',
  'asian paints': 'ASIANPAINT',
  'maruti': 'MARUTI',
  'maruti suzuki': 'MARUTI',
  'mahindra': 'M&M',
  'm&m': 'M&M',
  'mahindra and mahindra': 'M&M',
  'titan': 'TITAN',
  'titan company': 'TITAN',
  'sun pharma': 'SUNPHARMA',
  'sun pharmaceutical': 'SUNPHARMA',
  'dr reddy': 'DRREDDY',
  'cipla': 'CIPLA',
  'adani': 'ADANIENT',
  'adani enterprises': 'ADANIENT',
  'larsen': 'LT',
  'l&t': 'LT',
  'larsen and toubro': 'LT',
  'ultratech': 'ULTRACEMCO',
  'ultratech cement': 'ULTRACEMCO',
  'power grid': 'POWERGRID',
  'ntpc': 'NTPC',
  'ongc': 'ONGC',
  'coal india': 'COALINDIA',
  'ioc': 'IOC',
  'indian oil': 'IOC',
  'bpcl': 'BPCL',
  'bharat petroleum': 'BPCL',
  'grasim': 'GRASIM',
  'tata steel': 'TATASTEEL',
  'tata motors': 'TATAMOTORS',
  'tech mahindra': 'TECHM',
  'hcl tech': 'HCLTECH',
  'hcl': 'HCLTECH',
  'britannia': 'BRITANNIA',
  'nestle': 'NESTLEIND',
  'dabur': 'DABUR',
  'godrej': 'GODREJCP',
  'pidilite': 'PIDILITIND',
  'divi': 'DIVISLAB',
  'biocon': 'BIOCON',
  'srf': 'SRF',
  'indusind': 'INDUSINDBK',
  'indusind bank': 'INDUSINDBK',
  'bandhan': 'BANDHANBNK',
  'bandhan bank': 'BANDHANBNK',
  'yes bank': 'YESBANK',
  'pnb': 'PNB',
  'punjab national bank': 'PNB',
  'bank of baroda': 'BANKBARODA',
  'canara bank': 'CANBK',
};

/**
 * Parse user query to extract intent, ticker, and timeframe
 */
export function parseQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // Extract ticker/company name
  let ticker = null;
  let matchedPhrase = null;
  
  // Try to match company names (longest match first)
  const sortedKeys = Object.keys(TICKER_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lowerMessage.includes(key)) {
      ticker = TICKER_MAP[key];
      matchedPhrase = key;
      break;
    }
  }
  
  // Try to match ticker symbols directly (2-5 uppercase letters)
  if (!ticker) {
    const tickerMatch = message.match(/\b([A-Z]{2,10})\b/);
    if (tickerMatch) {
      ticker = tickerMatch[1];
      matchedPhrase = ticker;
    }
  }
  
  // Determine intent
  let intent = 'general';
  if (lowerMessage.includes('analyze') || lowerMessage.includes('analysis')) {
    intent = 'analyze';
  } else if (lowerMessage.includes('buy') || lowerMessage.includes('should i buy')) {
    intent = 'buy_recommendation';
  } else if (lowerMessage.includes('sell') || lowerMessage.includes('should i sell')) {
    intent = 'sell_recommendation';
  } else if (lowerMessage.includes('risk')) {
    intent = 'risk_analysis';
  } else if (lowerMessage.includes('outlook') || lowerMessage.includes('future') || lowerMessage.includes('forecast')) {
    intent = 'outlook';
  } else if (lowerMessage.includes('compare')) {
    intent = 'compare';
  } else if (lowerMessage.includes('sentiment')) {
    intent = 'sentiment';
  } else if (lowerMessage.includes('entry') || lowerMessage.includes('exit')) {
    intent = 'entry_exit';
  } else if (ticker) {
    intent = 'stock_query';
  }
  
  // Extract timeframe
  let timeframe = 'short-term';
  if (lowerMessage.includes('long term') || lowerMessage.includes('long-term')) {
    timeframe = 'long-term';
  } else if (lowerMessage.includes('medium term') || lowerMessage.includes('medium-term')) {
    timeframe = 'medium-term';
  } else if (lowerMessage.includes('intraday') || lowerMessage.includes('today')) {
    timeframe = 'intraday';
  }
  
  return {
    ticker,
    matchedPhrase,
    intent,
    timeframe,
    originalMessage: message
  };
}

/**
 * Fetch comprehensive stock data
 */
export async function fetchStockData(ticker) {
  try {
    // Fetch both detail and live quote in parallel
    const [detail, quotes] = await Promise.all([
      getStockDetail(ticker).catch(() => null),
      getLiveQuotes([ticker]).catch(() => null)
    ]);
    
    // Merge data
    const stockData = detail || {};
    const liveQuote = quotes?.quotes?.[ticker];
    
    if (liveQuote) {
      stockData.currentPrice = liveQuote.price;
      stockData.changePercent = liveQuote.changePercent;
      stockData.change = liveQuote.change;
    }
    
    return stockData;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}

/**
 * Generate dynamic analysis from real stock data
 */
export function generateAnalysis(stockData, intent, timeframe) {
  if (!stockData || !stockData.symbol) {
    return null;
  }
  
  const {
    symbol,
    currentPrice = 0,
    changePercent = 0,
    signal = 'Hold',
    confidence = 50,
    volume,
    trend,
    rsi,
    momentum,
    aiSummary,
    aiExplanation,
    risk = {},
    tags = []
  } = stockData;
  
  // Determine signal status
  const isBullish = signal.includes('Buy');
  const isBearish = signal.includes('Sell');
  const signalStatus = signal || 'Hold';
  
  // Calculate dynamic confidence
  const dynamicConfidence = confidence || 50;
  
  // Generate summary based on real data
  let summary = '';
  if (intent === 'analyze' || intent === 'stock_query') {
    summary = `${symbol} is currently trading at ₹${currentPrice.toLocaleString('en-IN')} with a ${changePercent >= 0 ? 'gain' : 'loss'} of ${Math.abs(changePercent).toFixed(2)}% today. `;
    
    if (isBullish) {
      summary += `The stock shows ${signal.toLowerCase()} signal with ${dynamicConfidence}% confidence. `;
      summary += aiSummary || aiExplanation || `Technical indicators suggest positive momentum with ${trend || 'upward'} trend.`;
    } else if (isBearish) {
      summary += `The stock shows ${signal.toLowerCase()} signal with ${dynamicConfidence}% confidence. `;
      summary += aiSummary || aiExplanation || `Technical indicators suggest caution with ${trend || 'downward'} pressure.`;
    } else {
      summary += `The stock shows a ${signal.toLowerCase()} signal. `;
      summary += aiSummary || aiExplanation || `Current market conditions suggest a wait-and-watch approach.`;
    }
  } else if (intent === 'risk_analysis') {
    const riskLevel = risk.level > 60 ? 'High' : risk.level > 40 ? 'Medium' : 'Low';
    summary = `${symbol} risk analysis: Current risk level is ${riskLevel} with a risk/reward ratio of ${risk.ratio || 'N/A'}. `;
    summary += `The stock is ${changePercent >= 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(2)}% today. `;
    summary += aiSummary || `Consider position sizing based on your risk tolerance.`;
  } else if (intent === 'outlook') {
    summary = `${symbol} ${timeframe} outlook: `;
    if (isBullish) {
      summary += `Positive momentum detected with ${dynamicConfidence}% confidence. `;
      summary += aiSummary || `Technical setup suggests potential upside in the ${timeframe}.`;
    } else if (isBearish) {
      summary += `Bearish pressure detected with ${dynamicConfidence}% confidence. `;
      summary += aiSummary || `Technical indicators suggest caution in the ${timeframe}.`;
    } else {
      summary += `Neutral stance with mixed signals. `;
      summary += aiSummary || `Wait for clearer directional bias before taking positions.`;
    }
  } else {
    summary = aiSummary || aiExplanation || `${symbol} is showing ${signal.toLowerCase()} signal with ${dynamicConfidence}% confidence based on current market data.`;
  }
  
  // Generate risk factors
  const riskFactors = [];
  if (changePercent < -2) {
    riskFactors.push(`Significant intraday decline of ${Math.abs(changePercent).toFixed(2)}%`);
  }
  if (risk.level > 60) {
    riskFactors.push('High volatility detected in recent trading sessions');
  }
  if (isBearish) {
    riskFactors.push('Technical indicators showing bearish divergence');
  }
  if (volume && volume.includes('M')) {
    const volNum = parseFloat(volume);
    if (volNum < 1) {
      riskFactors.push('Below-average trading volume may indicate low liquidity');
    }
  }
  if (riskFactors.length === 0) {
    riskFactors.push('Standard market risk applies');
    riskFactors.push('Monitor for trend reversal signals');
  }
  
  // Generate catalysts
  const catalysts = tags.length > 0 
    ? tags.map(tag => `${tag} pattern detected in recent price action`)
    : [
        `${momentum || 'Current'} momentum in ${symbol}`,
        `${trend || 'Market'} trend alignment`,
        `Volume analysis suggests ${isBullish ? 'accumulation' : isBearish ? 'distribution' : 'consolidation'}`
      ];
  
  // Determine action plan
  let action = 'Monitor';
  let actionTerm = timeframe;
  let actionTarget = null;
  
  if (isBullish && dynamicConfidence > 70) {
    action = 'Consider Entry';
    actionTarget = risk.rewardAmt || `Target: ${(currentPrice * 1.05).toFixed(2)}`;
  } else if (isBearish && dynamicConfidence > 70) {
    action = 'Reduce Exposure';
    actionTerm = 'Near-term';
  } else {
    action = 'Hold & Monitor';
  }
  
  // Calculate signal strength (1-5)
  const signalStrength = Math.ceil(dynamicConfidence / 20);
  
  return {
    summary,
    signalStatus,
    confidence: dynamicConfidence,
    action,
    actionTerm,
    actionTarget,
    riskFactors,
    catalysts,
    sentimentChange: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
    signalStrength,
    riskLevel: risk.level > 60 ? 'High' : risk.level > 40 ? 'Medium' : 'Low',
    ticker: symbol,
    currentPrice,
    liveQuote: {
      price: currentPrice,
      changePercent,
      change: stockData.change || 0
    },
    chartData: stockData.chartData || []
  };
}

/**
 * Generate fallback response when ticker cannot be resolved
 */
export function generateClarificationResponse(message) {
  return {
    summary: `I couldn't identify a specific stock ticker in your query. Could you please specify which stock you'd like to analyze? For example: "Analyze RELIANCE" or "What's the outlook for TCS?"`,
    signalStatus: 'N/A',
    confidence: 0,
    action: 'Clarify Query',
    actionTerm: 'Immediate',
    riskFactors: ['Please specify a valid stock ticker or company name'],
    catalysts: [],
    sentimentChange: 'N/A',
    signalStrength: 0,
    needsClarification: true
  };
}

/**
 * Generate error response when data fetch fails
 */
export function generateErrorResponse(ticker, error) {
  return {
    summary: `I encountered an issue fetching data for ${ticker}. This could be due to an invalid ticker symbol or temporary data unavailability. Please verify the ticker and try again.`,
    signalStatus: 'Error',
    confidence: 0,
    action: 'Retry',
    actionTerm: 'Immediate',
    riskFactors: [`Data unavailable for ${ticker}`, 'Please verify ticker symbol'],
    catalysts: [],
    sentimentChange: 'N/A',
    signalStrength: 0,
    error: true,
    errorMessage: error?.message || 'Data fetch failed'
  };
}

/**
 * Main assistant engine - processes query and returns complete analysis
 */
export async function processAssistantQuery(message) {
  // Parse query
  const parsed = parseQuery(message);
  
  // If no ticker found, return clarification
  if (!parsed.ticker) {
    return {
      type: 'clarification',
      data: generateClarificationResponse(message),
      parsed
    };
  }
  
  // Fetch stock data
  const stockData = await fetchStockData(parsed.ticker);
  
  // If data fetch failed, return error
  if (!stockData || !stockData.symbol) {
    return {
      type: 'error',
      data: generateErrorResponse(parsed.ticker, new Error('Data unavailable')),
      parsed
    };
  }
  
  // Generate analysis
  const analysis = generateAnalysis(stockData, parsed.intent, parsed.timeframe);
  
  // Determine response type
  const type = analysis.signalStatus.includes('Buy') ? 'bullish' : 
               analysis.signalStatus.includes('Sell') ? 'risky' : 'neutral';
  
  return {
    type,
    data: analysis,
    parsed,
    stockData
  };
}
