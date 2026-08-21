"""Yahoo Finance market data with simple TTL cache."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf
from cachetools import TTLCache

from app.services.symbols import find_symbol, liquid_universe, yahoo_ticker

_quote_cache: TTLCache = TTLCache(maxsize=512, ttl=120)
_history_cache: TTLCache = TTLCache(maxsize=256, ttl=900)
_trending_cache: TTLCache = TTLCache(maxsize=4, ttl=180)


def _empty_quote(exchange: str, symbol: str, name: str | None = None) -> dict[str, Any]:
    return {
        "exchange": exchange.upper(),
        "symbol": symbol.upper(),
        "name": name or symbol.upper(),
        "price": None,
        "change": None,
        "changePercent": None,
        "open": None,
        "high": None,
        "low": None,
        "previousClose": None,
        "volume": None,
        "currency": "INR",
        "asOf": datetime.now(timezone.utc).isoformat(),
    }


def get_quote(exchange: str, symbol: str) -> dict[str, Any]:
    key = f"{exchange.upper()}:{symbol.upper()}"
    if key in _quote_cache:
        return _quote_cache[key]

    meta = find_symbol(exchange, symbol)
    name = meta["name"] if meta else symbol.upper()
    ticker = yahoo_ticker(exchange, symbol)
    result = _empty_quote(exchange, symbol, name)

    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="5d", auto_adjust=True)
        if hist is not None and not hist.empty:
            last = hist.iloc[-1]
            prev = hist.iloc[-2] if len(hist) > 1 else last
            price = float(last["Close"])
            prev_close = float(prev["Close"])
            change = price - prev_close
            result.update(
                {
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "changePercent": round((change / prev_close) * 100, 2) if prev_close else 0.0,
                    "open": round(float(last["Open"]), 2),
                    "high": round(float(last["High"]), 2),
                    "low": round(float(last["Low"]), 2),
                    "previousClose": round(prev_close, 2),
                    "volume": int(last["Volume"]) if not pd.isna(last["Volume"]) else None,
                }
            )
    except Exception:
        pass

    _quote_cache[key] = result
    return result


RANGE_MAP = {
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
    "2y": "2y",
    "5y": "5y",
    "max": "max",
}


def get_history(exchange: str, symbol: str, range_key: str = "1y") -> dict[str, Any]:
    period = RANGE_MAP.get(range_key, "1y")
    key = f"{exchange.upper()}:{symbol.upper()}:{period}"
    if key in _history_cache:
        return _history_cache[key]

    ticker = yahoo_ticker(exchange, symbol)
    points: list[dict[str, Any]] = []
    try:
        hist = yf.Ticker(ticker).history(period=period, auto_adjust=True)
        if hist is not None and not hist.empty:
            for idx, row in hist.iterrows():
                points.append(
                    {
                        "date": idx.strftime("%Y-%m-%d"),
                        "open": round(float(row["Open"]), 2),
                        "high": round(float(row["High"]), 2),
                        "low": round(float(row["Low"]), 2),
                        "close": round(float(row["Close"]), 2),
                        "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
                    }
                )
    except Exception:
        points = []

    payload = {
        "exchange": exchange.upper(),
        "symbol": symbol.upper(),
        "range": period,
        "points": points,
    }
    _history_cache[key] = payload
    return payload


def get_trending(limit: int = 12) -> dict[str, Any]:
    cache_key = f"trending:{limit}"
    if cache_key in _trending_cache:
        return _trending_cache[cache_key]

    universe = liquid_universe()
    # Prefer NSE liquid names to avoid duplicate BSE mirrors slowing the panel
    nse_first = [s for s in universe if s["exchange"] == "NSE"]
    if len(nse_first) < 20:
        nse_first = universe
    # Cap concurrency for Yahoo rate limits
    sample = nse_first[:60]
    quotes: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(get_quote, item["exchange"], item["symbol"]): item for item in sample
        }
        for fut in as_completed(futures):
            try:
                q = fut.result()
                if q.get("price") is not None and q.get("changePercent") is not None:
                    quotes.append(q)
            except Exception:
                continue

    sorted_q = sorted(quotes, key=lambda x: abs(x.get("changePercent") or 0), reverse=True)
    gainers = sorted(
        [q for q in quotes if (q.get("changePercent") or 0) > 0],
        key=lambda x: x.get("changePercent") or 0,
        reverse=True,
    )[:limit]
    losers = sorted(
        [q for q in quotes if (q.get("changePercent") or 0) < 0],
        key=lambda x: x.get("changePercent") or 0,
    )[:limit]
    movers = sorted_q[:limit]

    payload = {
        "movers": movers,
        "gainers": gainers,
        "losers": losers,
        "asOf": datetime.now(timezone.utc).isoformat(),
    }
    _trending_cache[cache_key] = payload
    return payload
