"""
Tag Generator for SignalForge

This module generates descriptive tags for stock signals
based on volume, trend, and signal characteristics.
"""

from typing import List, Union


def generate_tags(signal_type: str, volume_or_score: Union[int, float],
                  trend: str = "Unknown", score: int = 0) -> List[str]:
    """
    Generate relevant tags for stock signal.

    Supports two call signatures for compatibility:
      - generate_tags(signal_type, volume, trend, score)   [stock_service / portfolio_service]
      - generate_tags(signal_type, score)                  [main.py scan endpoint]

    Args:
        signal_type: Type of signal detected
        volume_or_score: Trading volume (int) OR confidence score (int/float)
        trend: Trend analysis result (optional)
        score: Confidence score when volume is passed as second arg

    Returns:
        List of descriptive tags
    """
    tags = []

    # Determine if called with (signal_type, score) or (signal_type, volume, trend, score)
    if trend == "Unknown" and score == 0:
        # Called as generate_tags(signal_type, score)
        actual_score = int(volume_or_score)
        volume = 0
        volume_spike = False
        actual_trend = "Unknown"
    else:
        # Called as generate_tags(signal_type, volume, trend, score)
        volume = int(volume_or_score)
        actual_score = score
        actual_trend = trend
        volume_spike = volume > 1_000_000

    # Volume-based tags
    if volume_spike:
        tags.append("High Volume")
    elif volume > 500_000:
        tags.append("Moderate Volume")
    elif volume > 0:
        tags.append("Low Volume")

    # Trend-based tags
    if actual_trend in ("uptrend", "Bullish"):
        tags.append("Uptrend")
    elif actual_trend == "sideways":
        tags.append("Sideways")
    elif actual_trend in ("downtrend", "Bearish"):
        tags.append("Downtrend")

    # Signal-based tags
    if signal_type == "Breakout":
        tags.append("Breakout")
    elif signal_type == "Momentum":
        tags.append("Momentum")
    else:
        tags.append("Weak Signal")

    # Score-based tags
    if actual_score >= 80:
        tags.append("High Confidence")
    elif actual_score >= 60:
        tags.append("Medium Confidence")
    else:
        tags.append("Low Confidence")

    return tags


def generate_risk_note(signal_type: str, score_or_volume_spike: Union[int, float, bool],
                       trend: str = "Unknown", score: int = 0) -> str:
    """
    Generate simple risk note for stock signal.

    Supports two call signatures for compatibility:
      - generate_risk_note(signal_type, score)                        [main.py / portfolio_service]
      - generate_risk_note(signal_type, volume_spike, trend, score)   [original full signature]

    Args:
        signal_type: Type of signal detected
        score_or_volume_spike: Confidence score (int) OR volume_spike bool
        trend: Trend analysis result (optional)
        score: Confidence score when volume_spike is passed as second arg

    Returns:
        Risk note string
    """
    # Detect call style
    if isinstance(score_or_volume_spike, bool):
        volume_spike = score_or_volume_spike
        actual_score = score
        actual_trend = trend
    else:
        # Called as generate_risk_note(signal_type, score)
        actual_score = int(score_or_volume_spike)
        volume_spike = actual_score > 60
        actual_trend = trend

    if signal_type == "Breakout":
        if not volume_spike:
            return "Risk of false breakout due to weak volume confirmation."
        elif actual_score < 60:
            return "Risk of breakout failure without strong momentum."
        else:
            return "Risk of consolidation after initial breakout move."

    elif signal_type == "Momentum":
        if not volume_spike:
            return "Risk of momentum reversal without volume support."
        elif actual_trend in ("weak", "sideways"):
            return "Risk of trend continuation with weak foundation."
        else:
            return "Risk of momentum fade in overbought conditions."

    else:  # Weak signal
        if actual_trend == "sideways":
            return "Risk of continued consolidation with no clear direction."
        else:
            return "Risk of unpredictable movement with low conviction."
