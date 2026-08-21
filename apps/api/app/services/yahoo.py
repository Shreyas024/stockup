"""Yahoo Finance helpers with NSE/BSE ticker fallbacks."""

from __future__ import annotations

import pandas as pd
import yfinance as yf

from app.services.symbols import yahoo_ticker


def candidate_tickers(exchange: str, symbol: str) -> list[str]:
    """Ordered Yahoo tickers to try for an NSE/BSE symbol.

    Many BSE listings are stored under numeric codes on Yahoo, while our
    symbol master often uses the NSE-style name with a .BO suffix. Prefer the
    requested exchange, then fall back to the other Indian suffix.
    """
    primary = yahoo_ticker(exchange, symbol)
    alt_exchange = "NSE" if exchange.upper() == "BSE" else "BSE"
    secondary = yahoo_ticker(alt_exchange, symbol)
    out: list[str] = []
    for t in (primary, secondary):
        if t not in out:
            out.append(t)
    return out


def download_history(exchange: str, symbol: str, period: str = "5y", min_rows: int = 1) -> pd.DataFrame:
    """Fetch OHLCV history, trying alternate Indian Yahoo suffixes if needed."""
    last_empty = pd.DataFrame()
    for ticker in candidate_tickers(exchange, symbol):
        try:
            hist = yf.Ticker(ticker).history(period=period, auto_adjust=True)
        except Exception:
            continue
        if hist is None or hist.empty:
            continue
        if len(hist) >= min_rows:
            return hist
        if len(hist) > len(last_empty):
            last_empty = hist
    return last_empty
