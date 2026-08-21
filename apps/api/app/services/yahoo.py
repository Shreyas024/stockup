"""Yahoo Finance helpers with NSE/BSE ticker fallbacks."""

from __future__ import annotations

import pandas as pd
import yfinance as yf

from app.services.symbols import find_symbol, yahoo_ticker

# Yahoo / exchange renames that break SYMBOL.NS lookups
KNOWN_YAHOO_ALIASES: dict[str, list[str]] = {
    "ZOMATO": ["ETERNAL.NS", "ETERNAL.BO"],
    "MCDOWELL-N": ["UNITDSPR.NS", "UNITDSPR.BO"],
}


def _search_tickers(query: str, exchange: str) -> list[str]:
    out: list[str] = []
    try:
        found = yf.Search(query, max_results=10).quotes or []
    except Exception:
        return out

    want_suffix = ".NS" if exchange.upper() == "NSE" else ".BO"
    alt_suffix = ".BO" if want_suffix == ".NS" else ".NS"
    ranked: list[str] = []
    for row in found:
        sym = str(row.get("symbol") or "")
        if sym.endswith((".NS", ".BO")):
            ranked.append(sym)

    for prefer in (want_suffix, alt_suffix):
        for sym in ranked:
            if sym.endswith(prefer) and sym not in out:
                out.append(sym)
    for sym in ranked:
        if sym not in out:
            out.append(sym)
    return out


def candidate_tickers(exchange: str, symbol: str) -> list[str]:
    """Ordered Yahoo tickers to try for an NSE/BSE symbol."""
    primary = yahoo_ticker(exchange, symbol)
    alt_exchange = "NSE" if exchange.upper() == "BSE" else "BSE"
    secondary = yahoo_ticker(alt_exchange, symbol)
    out: list[str] = []
    for t in (primary, secondary):
        if t not in out:
            out.append(t)

    for alias in KNOWN_YAHOO_ALIASES.get(symbol.upper(), []):
        if alias not in out:
            out.append(alias)

    for t in _search_tickers(symbol, exchange):
        if t not in out:
            out.append(t)

    meta = find_symbol(exchange, symbol)
    if meta and meta.get("name"):
        name_q = str(meta["name"]).split()[0]
        if len(name_q) >= 3 and name_q.upper() != symbol.upper():
            for t in _search_tickers(name_q, exchange):
                if t not in out:
                    out.append(t)

    return out


def download_history(exchange: str, symbol: str, period: str = "5y", min_rows: int = 1) -> pd.DataFrame:
    """Fetch OHLCV history, trying alternate Indian Yahoo suffixes if needed.

    Picks the series with the most bars among candidates (and retries with
    period=max when the requested window is thin).
    """
    best = pd.DataFrame()
    periods = [period]
    if period != "max":
        periods.append("max")

    for ticker in candidate_tickers(exchange, symbol):
        for p in periods:
            try:
                hist = yf.Ticker(ticker).history(period=p, auto_adjust=True)
            except Exception:
                continue
            if hist is None or hist.empty:
                continue
            if len(hist) > len(best):
                best = hist
            if len(best) >= max(min_rows, 50):
                return best

    return best
