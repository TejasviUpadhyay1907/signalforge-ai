"""
Signal Detection Engine for SignalForge

This module analyzes stock data to detect meaningful market signals.
It identifies patterns like breakouts, momentum, and weak signals.
"""

from typing import Dict, List, Tuple
from et_backend.data.fetcher import fetch_stock_data


# ✅ ADDED THIS FUNCTION (FIX)
def validate_stock_data(stock_data: Dict) -> bool:
    """
    Validate stock data structure.
    """
    required_keys = ['current_price', 'volume', 'last_5_days_closes']

    if not stock_data:
        return False

    for key in required_keys:
        if key not in stock_data:
            return False

    return True


def calculate_price_change(current_price: float, previous_close: float) -> float:
    if previous_close == 0:
        return 0.0
    
    return ((current_price - previous_close) / previous_close) * 100


def detect_volume_spike(current_volume: int, historical_volumes: List[int]) -> bool:
    if not historical_volumes or current_volume == 0:
        return False
    
    avg_volume = sum(historical_volumes) / len(historical_volumes)
    return current_volume > (avg_volume * 1.5)


def estimate_volume_spike(current_volume: int) -> bool:
    if current_volume > 5000000:
        return True
    elif current_volume > 2000000:
        return True
    else:
        return False


def analyze_trend(closing_prices: List[float]) -> str:
    if len(closing_prices) < 3:
        return 'weak'
    
    prices = closing_prices[-5:] if len(closing_prices) >= 5 else closing_prices
    
    changes = []
    for i in range(1, len(prices)):
        change = (prices[i] - prices[i-1]) / prices[i-1] * 100
        changes.append(change)
    
    if not changes:
        return 'weak'
    
    up_days = sum(1 for change in changes if change > 0)
    down_days = sum(1 for change in changes if change < 0)
    total_days = len(changes)
    
    total_change = ((prices[-1] - prices[0]) / prices[0]) * 100
    
    up_ratio = up_days / total_days
    
    if up_ratio >= 0.75 and total_change > 1.0:
        return 'uptrend'
    elif up_ratio <= 0.25 and total_change < -1.0:
        return 'downtrend'
    elif 0.4 <= up_ratio <= 0.6 and abs(total_change) < 1.0:
        return 'sideways'
    else:
        return 'weak'


def is_sideways_breakout(closing_prices: List[float], price_change: float) -> bool:
    if len(closing_prices) < 4:
        return False
    
    previous_prices = closing_prices[:-1]
    trend = analyze_trend(previous_prices)
    
    return trend == 'sideways' and price_change > 1.5


def detect_signal(stock_data: Dict) -> Dict:

    # ✅ NOW THIS WORKS
    if not validate_stock_data(stock_data):
        return {
            'signal_type': 'Weak',
            'price_change': 0.0,
            'volume_spike': False,
            'trend': 'weak',
            'confidence': 0
        }
    
    current_price = stock_data.get('current_price', 0)
    previous_close = stock_data.get('previous_close', current_price)
    current_volume = stock_data.get('volume', 0)
    closing_prices = stock_data.get('last_5_days_closes', [])
    
    price_change = calculate_price_change(current_price, previous_close)
    trend = analyze_trend(closing_prices)
    volume_spike = estimate_volume_spike(current_volume)
    sideways_breakout = is_sideways_breakout(closing_prices, price_change)
    
    signal_type = 'Weak'
    confidence = 0
    
    if (price_change >= 2.0 and volume_spike and sideways_breakout):
        signal_type = 'Breakout'
        confidence = 85
    
    elif (trend == 'uptrend' and current_volume > 1000000 and price_change >= 1.0):
        signal_type = 'Momentum'
        confidence = 70
    
    elif (trend in ['uptrend', 'sideways'] and current_volume > 500000 and price_change >= 0.8):
        signal_type = 'Momentum'
        confidence = 55
    
    elif (price_change >= 0.3):
        signal_type = 'Weak'
        confidence = 30
    
    else:
        signal_type = 'Weak'
        confidence = 15
    
    return {
        'signal_type': signal_type,
        'price_change': round(price_change, 2),
        'volume_spike': volume_spike,
        'trend': trend,
        'confidence': confidence
    }


def detect_signals_batch(stocks_data: Dict[str, Dict]) -> Dict[str, Dict]:
    results = {}
    
    for symbol, stock_data in stocks_data.items():
        results[symbol] = detect_signal(stock_data)
    
    return results