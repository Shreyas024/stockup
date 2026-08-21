"""Technical analysis + simple ML price forecast."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from app.services.symbols import find_symbol
from app.services.yahoo import download_history

DISCLAIMER = (
    "Not financial advice. Signals and forecasts are educational estimates based on "
    "historical price patterns and do not guarantee future performance. Invest at your own risk."
)


def _rsi(series: pd.Series, period: int = 14) -> float | None:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iloc[-1]
    return None if pd.isna(val) else float(val)


def _macd(series: pd.Series) -> dict[str, float | None]:
    ema12 = series.ewm(span=12, adjust=False).mean()
    ema26 = series.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal
    def last(s: pd.Series) -> float | None:
        v = s.iloc[-1]
        return None if pd.isna(v) else float(v)

    return {"macd": last(macd_line), "signal": last(signal), "histogram": last(hist)}


def _score_signal(close: float, sma20: float | None, sma50: float | None, sma200: float | None, rsi: float | None, macd_hist: float | None) -> tuple[str, int, list[str]]:
    score = 0
    reasons: list[str] = []

    if sma50 is not None:
        if close > sma50:
            score += 2
            reasons.append("Price is above the 50-day moving average (short-term uptrend).")
        else:
            score -= 2
            reasons.append("Price is below the 50-day moving average (short-term weakness).")

    if sma200 is not None:
        if close > sma200:
            score += 2
            reasons.append("Price is above the 200-day moving average (longer-term uptrend).")
        else:
            score -= 2
            reasons.append("Price is below the 200-day moving average (longer-term downtrend).")

    if sma20 is not None and sma50 is not None:
        if sma20 > sma50:
            score += 1
            reasons.append("20-day MA is above 50-day MA (momentum supportive).")
        else:
            score -= 1
            reasons.append("20-day MA is below 50-day MA (momentum soft).")

    if rsi is not None:
        if rsi < 30:
            score += 2
            reasons.append(f"RSI at {rsi:.1f} suggests oversold conditions.")
        elif rsi > 70:
            score -= 2
            reasons.append(f"RSI at {rsi:.1f} suggests overbought conditions.")
        elif 40 <= rsi <= 60:
            score += 1
            reasons.append(f"RSI at {rsi:.1f} is in a neutral-healthy zone.")
        else:
            reasons.append(f"RSI at {rsi:.1f} is neither extreme nor strongly supportive.")

    if macd_hist is not None:
        if macd_hist > 0:
            score += 1
            reasons.append("MACD histogram is positive (bullish momentum).")
        else:
            score -= 1
            reasons.append("MACD histogram is negative (bearish momentum).")

    if score >= 3:
        signal = "Buy"
    elif score <= -3:
        signal = "Sell"
    else:
        signal = "Hold"

    # Confidence 40–92 based on |score|
    confidence = int(min(92, 40 + abs(score) * 8))
    return signal, confidence, reasons


def _forecast(closes: pd.Series, dates: pd.DatetimeIndex, horizon_days: int) -> list[dict[str, Any]]:
    """Linear regression on log-price with residual-based confidence band."""
    y = np.log(closes.values.astype(float))
    n = len(y)
    if n < 30:
        return []

    # Use last ~180 trading days for the model fit
    window = min(n, 180)
    y_w = y[-window:]
    x_w = np.arange(window).reshape(-1, 1)
    model = LinearRegression()
    model.fit(x_w, y_w)
    residuals = y_w - model.predict(x_w)
    std = float(np.std(residuals)) if len(residuals) else 0.02

    last_date = dates[-1].to_pydatetime()
    if last_date.tzinfo is None:
        last_date = last_date.replace(tzinfo=timezone.utc)

    out: list[dict[str, Any]] = []
    for i in range(1, horizon_days + 1):
        x_f = np.array([[window - 1 + i]])
        log_p = float(model.predict(x_f)[0])
        # Widen band with horizon
        band = std * (1 + 0.08 * i)
        price = float(np.exp(log_p))
        low = float(np.exp(log_p - 1.28 * band))
        high = float(np.exp(log_p + 1.28 * band))
        # Skip weekends roughly by adding calendar days and rolling forward
        d = last_date + timedelta(days=i)
        while d.weekday() >= 5:
            d += timedelta(days=1)
        out.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "predicted": round(price, 2),
                "low": round(low, 2),
                "high": round(high, 2),
            }
        )
    return out


def analyse_stock(exchange: str, symbol: str, horizon_days: int = 14) -> dict[str, Any]:
    horizon_days = max(3, min(int(horizon_days), 30))
    meta = find_symbol(exchange, symbol)
    name = meta["name"] if meta else symbol.upper()

    # Prefer requested exchange; fall back to NSE/BSE alternate Yahoo suffix
    # when BSE name-based tickers (e.g. TATASTEEL.BO) have almost no history.
    hist = download_history(exchange, symbol, period="5y", min_rows=50)
    if hist is None or hist.empty or len(hist) < 50:
        return {
            "exchange": exchange.upper(),
            "symbol": symbol.upper(),
            "name": name,
            "error": "Insufficient historical data to analyse this stock.",
            "disclaimer": DISCLAIMER,
        }

    close = hist["Close"].astype(float)
    sma20 = close.rolling(20).mean().iloc[-1]
    sma50 = close.rolling(50).mean().iloc[-1]
    sma200 = close.rolling(200).mean().iloc[-1] if len(close) >= 200 else np.nan
    rsi = _rsi(close)
    macd = _macd(close)

    price = float(close.iloc[-1])
    sma20_v = None if pd.isna(sma20) else float(sma20)
    sma50_v = None if pd.isna(sma50) else float(sma50)
    sma200_v = None if pd.isna(sma200) else float(sma200)

    # Past year performance summary
    lookback = min(len(close), 252)
    past = close.iloc[-lookback:]
    past_return = float((past.iloc[-1] / past.iloc[0] - 1) * 100)
    peak = float(past.max())
    trough = float(past.min())
    drawdown = float((price / peak - 1) * 100)

    signal, confidence, reasons = _score_signal(
        price, sma20_v, sma50_v, sma200_v, rsi, macd.get("histogram")
    )

    hist_points = [
        {"date": idx.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 2)}
        for idx, row in hist.iloc[-lookback:].iterrows()
    ]
    forecast = _forecast(close, hist.index, horizon_days)

    trend_label = "Uptrend" if past_return > 8 else "Downtrend" if past_return < -8 else "Sideways"

    return {
        "exchange": exchange.upper(),
        "symbol": symbol.upper(),
        "name": name,
        "signal": signal,
        "confidence": confidence,
        "reasons": reasons,
        "currentPrice": round(price, 2),
        "horizonDays": horizon_days,
        "trendSummary": {
            "label": trend_label,
            "pastReturnPercent": round(past_return, 2),
            "drawdownFromHighPercent": round(drawdown, 2),
            "yearHigh": round(peak, 2),
            "yearLow": round(trough, 2),
        },
        "indicators": {
            "sma20": round(sma20_v, 2) if sma20_v is not None else None,
            "sma50": round(sma50_v, 2) if sma50_v is not None else None,
            "sma200": round(sma200_v, 2) if sma200_v is not None else None,
            "rsi": round(rsi, 2) if rsi is not None else None,
            "macd": {k: (round(v, 4) if v is not None else None) for k, v in macd.items()},
        },
        "history": hist_points,
        "forecast": forecast,
        "disclaimer": DISCLAIMER,
        "asOf": datetime.now(timezone.utc).isoformat(),
    }
