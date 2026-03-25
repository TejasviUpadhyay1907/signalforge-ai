"""
Data Fetcher Module for SignalForge
This module handles fetching stock market data using yfinance.
"""

import yfinance as yf
import pandas as pd
from typing import Dict, List, Optional, Any
from datetime import datetime

from et_backend.utils.cache import stock_data_cache
from et_backend.utils.logger import get_logger

logger = get_logger(__name__)


def fetch_stock_data(symbols: List[str], period: str = "1mo") -> Dict[str, Dict]:
    """
    Fetch stock data for multiple symbols with caching.
    """

    result = {}
    uncached_symbols = []

    # Check cache first
    for symbol in symbols:
        cached_data = stock_data_cache.get(symbol, period=period)
        if cached_data is not None:
            result[symbol] = cached_data
            logger.debug(f"Cache hit for {symbol}")
        else:
            uncached_symbols.append(symbol)

    # Fetch uncached data
    if uncached_symbols:
        logger.info(f"Fetching data for {len(uncached_symbols)} uncached symbols: {uncached_symbols}")

        try:
            tickers = [yf.Ticker(symbol) for symbol in uncached_symbols]

            data = yf.download(
                " ".join(uncached_symbols),
                period=period,
                progress=False,
                group_by="ticker"
            )

            for i, symbol in enumerate(uncached_symbols):
                try:
                    symbol_data = _process_ticker_data(tickers[i], data, symbol, period)
                    result[symbol] = symbol_data

                    stock_data_cache.set(symbol, symbol_data, ttl=600, period=period)
                    logger.debug(f"Cached data for {symbol}")

                except Exception as e:
                    logger.error(f"Error processing {symbol}: {str(e)}")
                    result[symbol] = {"error": str(e)}

        except Exception as e:
            logger.error(f"Error fetching stock data: {str(e)}")

            for symbol in uncached_symbols:
                if symbol not in result:
                    result[symbol] = {"error": str(e)}

    logger.info(f"Stock data fetch completed: {len(result)} symbols, {len(uncached_symbols)} API calls")

    return result


def get_single_stock_data(symbol: str, period: str = "1mo") -> Optional[Dict[str, Any]]:
    """
    Get data for a single stock with caching.
    """

    cached_data = stock_data_cache.get(symbol, period=period)
    if cached_data is not None:
        logger.debug(f"Cache hit for single stock {symbol}")
        return cached_data

    logger.info(f"Fetching single stock data for {symbol}")

    try:
        ticker = yf.Ticker(symbol)
        hist_data = ticker.history(period=period)

        if hist_data.empty:
            logger.warning(f"No historical data found for {symbol}")
            return None

        stock_data = _process_ticker_data(ticker, hist_data, symbol, period)

        stock_data_cache.set(symbol, stock_data, ttl=600, period=period)
        logger.debug(f"Cached single stock data for {symbol}")

        return stock_data

    except Exception as e:
        logger.error(f"Error fetching single stock data for {symbol}: {str(e)}")
        return None


def fetch_stock_ohlc_data(symbol: str, period_days: int = 60) -> Dict[str, Any]:
    """
    Fetch OHLC data for a stock with caching.
    """

    cache_key = f"ohlc_{symbol}_{period_days}"

    cached_data = stock_data_cache.get(cache_key)
    if cached_data is not None:
        logger.debug(f"Cache hit for OHLC data {symbol}")
        return cached_data

    logger.info(f"Fetching OHLC data for {symbol} ({period_days} days)")

    try:
        ticker = yf.Ticker(symbol)

        if period_days <= 5:
            period_str = "5d"
        elif period_days <= 30:
            period_str = "1mo"
        elif period_days <= 90:
            period_str = "3mo"
        elif period_days <= 180:
            period_str = "6mo"
        else:
            period_str = "1y"

        hist_data = ticker.history(period=period_str)

        if hist_data.empty:
            logger.warning(f"No historical data found for {symbol}")
            return {"error": f"No data available for {symbol}"}

        current_price = float(hist_data["Close"].iloc[-1])
        current_volume = int(hist_data["Volume"].iloc[-1])

        historical_data = []

        for date, row in hist_data.iterrows():
            historical_data.append({
                "timestamp": date,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"])
            })

        if len(historical_data) > period_days:
            historical_data = historical_data[-period_days:]

        result = {
            "symbol": symbol.replace(".NS", ""),
            "current_price": current_price,
            "current_volume": current_volume,
            "historical_data": historical_data,
            "data_points": len(historical_data)
        }

        stock_data_cache.set(cache_key, result, ttl=600)
        logger.debug(f"Cached OHLC data for {symbol}")

        return result

    except Exception as e:
        logger.error(f"Error fetching OHLC data for {symbol}: {str(e)}")
        return {"error": f"Failed to fetch data for {symbol}: {str(e)}"}


def _process_ticker_data(ticker: yf.Ticker, data: pd.DataFrame, symbol: str, period: str) -> Dict[str, Any]:
    """
    Process ticker data into standardized format.
    """

    try:
        current_price = float(
            ticker.info.get("currentPrice", 0)
            or ticker.info.get("regularMarketPrice", 0)
            or (data["Close"].iloc[-1] if not data.empty else 0)
        )

        volume = int(
            ticker.info.get("volume", 0)
            or (data["Volume"].iloc[-1] if not data.empty else 0)
        )

        last_5_days_closes = []
        last_5_days_dates = []

        if not data.empty and len(data) >= 5:
            recent_data = data.tail(5)
            last_5_days_closes = [float(price) for price in recent_data["Close"]]
            last_5_days_dates = [date.isoformat() for date in recent_data.index]
        else:
            last_5_days_closes = [float(price) for price in data["Close"]]
            last_5_days_dates = [date.isoformat() for date in data.index]

        return {
            "symbol": symbol,
            "current_price": current_price,
            "volume": volume,
            "last_5_days_closes": last_5_days_closes,
            "last_5_days_dates": last_5_days_dates,
            "period": period,
            "data_points": len(data),
            "last_updated": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error processing ticker data for {symbol}: {str(e)}")

        return {
            "symbol": symbol,
            "error": str(e),
            "current_price": 0,
            "volume": 0,
            "last_5_days_closes": [],
            "last_5_days_dates": [],
            "period": period,
            "data_points": 0,
            "last_updated": datetime.now().isoformat()
        }