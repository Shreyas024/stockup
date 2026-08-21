"""Technical analysis + simple ML price forecast."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from app.services.symbols import find_symbol
from app.services.yahoo import download_history

DISCLAIMER = (
    "Not financial advice. Signals and forecasts are educational estimates based on "
    "historical price patterns and do not guarantee future performance. Invest at your own risk."
)

IST = ZoneInfo("Asia/Kolkata")
MIN_BARS = 3  # allow newly listed stocks; indicators degrade gracefully


def _rsi(series: pd.Series, period: int = 14) -> float | None:
    period = min(period, max(2, len(series) - 1))
    if len(series) < period + 1:
        return None
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iloc[-1]
    return None if pd.isna(val) else float(val)


def _macd(series: pd.Series) -> dict[str, float | None]:
    if len(series) < 26:
        return {"macd": None, "signal": None, "histogram": None}
    ema12 = series.ewm(span=12, adjust=False).mean()
    ema26 = series.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal

    def last(s: pd.Series) -> float | None:
        v = s.iloc[-1]
        return None if pd.isna(v) else float(v)

    return {"macd": last(macd_line), "signal": last(signal), "histogram": last(hist)}


def _sma(series: pd.Series, window: int) -> float | None:
    if len(series) < window:
        return None
    val = series.rolling(window).mean().iloc[-1]
    return None if pd.isna(val) else float(val)


def _score_signal(
    close: float,
    sma20: float | None,
    sma50: float | None,
    sma200: float | None,
    rsi: float | None,
    macd_hist: float | None,
    recent_return: float | None = None,
) -> tuple[str, int, list[str]]:
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
    elif sma20 is not None:
        if close > sma20:
            score += 1
            reasons.append("Price is above the 20-day moving average.")
        else:
            score -= 1
            reasons.append("Price is below the 20-day moving average.")

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

    if recent_return is not None and sma50 is None and sma200 is None:
        if recent_return > 3:
            score += 1
            reasons.append(f"Short listing history shows a {recent_return:.1f}% rise from first available close.")
        elif recent_return < -3:
            score -= 1
            reasons.append(f"Short listing history shows a {recent_return:.1f}% drop from first available close.")
        else:
            reasons.append("Short listing history is roughly flat so far.")

    if score >= 3:
        signal = "Buy"
    elif score <= -3:
        signal = "Sell"
    else:
        signal = "Hold"

    confidence = int(min(92, 40 + abs(score) * 8))
    return signal, confidence, reasons


def _fit_log_price_model(closes: pd.Series) -> tuple[LinearRegression, int, float] | None:
    y = np.log(np.clip(closes.values.astype(float), 1e-9, None))
    n = len(y)
    if n < 8:
        return None
    window = min(n, 180)
    y_w = y[-window:]
    x_w = np.arange(window).reshape(-1, 1)
    model = LinearRegression()
    model.fit(x_w, y_w)
    residuals = y_w - model.predict(x_w)
    std = float(np.std(residuals)) if len(residuals) else 0.02
    std = max(std, 0.005)
    return model, window, std


def _next_trading_days(after: date, count: int) -> list[date]:
    out: list[date] = []
    d = after
    while len(out) < count:
        d += timedelta(days=1)
        if d.weekday() < 5:
            out.append(d)
    return out


def _predict_at_step(model: LinearRegression, window: int, std: float, step: int) -> dict[str, float]:
    x_f = np.array([[window - 1 + step]])
    log_p = float(model.predict(x_f)[0])
    band = std * (1 + 0.08 * max(step, 1))
    return {
        "predicted": round(float(np.exp(log_p)), 2),
        "low": round(float(np.exp(log_p - 1.28 * band)), 2),
        "high": round(float(np.exp(log_p + 1.28 * band)), 2),
    }


def _momentum_forecast(closes: pd.Series, dates: pd.DatetimeIndex, horizon_days: int) -> list[dict[str, Any]]:
    """Fallback forecast for very short histories using average daily return."""
    if len(closes) < 2:
        return []
    rets = closes.pct_change().dropna()
    mean_ret = float(rets.tail(min(10, len(rets))).mean()) if len(rets) else 0.0
    vol = float(rets.tail(min(10, len(rets))).std()) if len(rets) > 1 else 0.02
    vol = max(vol if not np.isnan(vol) else 0.02, 0.01)

    last_ts = dates[-1].to_pydatetime()
    if last_ts.tzinfo is not None:
        last_ts = last_ts.astimezone(IST)
    sessions = _next_trading_days(last_ts.date(), horizon_days)
    price = float(closes.iloc[-1])
    out: list[dict[str, Any]] = []
    for i, session in enumerate(sessions, start=1):
        pred = price * ((1 + mean_ret) ** i)
        band = pred * vol * (1 + 0.1 * i)
        out.append(
            {
                "date": session.isoformat(),
                "predicted": round(pred, 2),
                "low": round(max(pred - band, 0), 2),
                "high": round(pred + band, 2),
            }
        )
    return out


def _forecast(closes: pd.Series, dates: pd.DatetimeIndex, horizon_days: int) -> list[dict[str, Any]]:
    fitted = _fit_log_price_model(closes)
    if fitted is None:
        return _momentum_forecast(closes, dates, horizon_days)
    model, window, std = fitted

    last_date = dates[-1].to_pydatetime()
    if last_date.tzinfo is not None:
        last_date = last_date.astimezone(IST)
    sessions = _next_trading_days(last_date.date(), horizon_days)

    out: list[dict[str, Any]] = []
    for i, session in enumerate(sessions, start=1):
        pred = _predict_at_step(model, window, std, i)
        out.append(
            {
                "date": session.isoformat(),
                "predicted": pred["predicted"],
                "low": pred["low"],
                "high": pred["high"],
            }
        )
    return out


def _session_close_forecast(closes: pd.Series, dates: pd.DatetimeIndex) -> dict[str, Any]:
    fitted = _fit_log_price_model(closes)
    last_ts = dates[-1].to_pydatetime()
    if last_ts.tzinfo is not None:
        last_ts = last_ts.astimezone(IST)
    last_hist = last_ts.date()
    last_close = float(closes.iloc[-1])

    now = datetime.now(IST)
    today = now.date()

    if today.weekday() < 5:
        session_today = today
    else:
        session_today = _next_trading_days(today, 1)[0]
    session_tomorrow = _next_trading_days(session_today, 1)[0]

    def steps_ahead(target: date) -> int:
        if target <= last_hist:
            return 0
        count = 0
        d = last_hist
        while d < target:
            d += timedelta(days=1)
            if d.weekday() < 5:
                count += 1
        return max(count, 1)

    def build_from_model(target: date, label: str, kind: str) -> dict[str, Any]:
        assert fitted is not None
        model, window, std = fitted
        step = steps_ahead(target)
        if step == 0:
            one = _predict_at_step(model, window, std, 1)
            move = one["predicted"] - last_close
            predicted = round(last_close + 0.55 * move, 2)
            band = abs(one["high"] - one["predicted"])
            low = round(predicted - band, 2)
            high = round(predicted + band, 2)
        else:
            pred = _predict_at_step(model, window, std, step)
            predicted, low, high = pred["predicted"], pred["low"], pred["high"]

        change = round(predicted - last_close, 2)
        change_pct = round((change / last_close) * 100, 2) if last_close else 0.0
        return {
            "kind": kind,
            "label": label,
            "date": target.isoformat(),
            "weekday": target.strftime("%A"),
            "predicted": predicted,
            "low": low,
            "high": high,
            "vsLastClose": change,
            "vsLastClosePercent": change_pct,
        }

    def build_from_momentum(target: date, label: str, kind: str, step: int) -> dict[str, Any]:
        points = _momentum_forecast(closes, dates, max(step, 1))
        if not points:
            return {
                "kind": kind,
                "label": label,
                "date": target.isoformat(),
                "weekday": target.strftime("%A"),
                "predicted": round(last_close, 2),
                "low": round(last_close * 0.98, 2),
                "high": round(last_close * 1.02, 2),
                "vsLastClose": 0.0,
                "vsLastClosePercent": 0.0,
            }
        idx = min(step, len(points)) - 1
        p = points[idx]
        change = round(p["predicted"] - last_close, 2)
        change_pct = round((change / last_close) * 100, 2) if last_close else 0.0
        return {
            "kind": kind,
            "label": label,
            "date": target.isoformat(),
            "weekday": target.strftime("%A"),
            "predicted": p["predicted"],
            "low": p["low"],
            "high": p["high"],
            "vsLastClose": change,
            "vsLastClosePercent": change_pct,
        }

    today_label = (
        "Predicted close today"
        if session_today == today
        else f"Predicted close today · next session ({session_today.strftime('%d %b')})"
    )
    if session_tomorrow == today + timedelta(days=1):
        tomorrow_label = "Predicted close tomorrow"
    else:
        tomorrow_label = f"Predicted close tomorrow · {session_tomorrow.strftime('%A, %d %b')}"

    if fitted is not None:
        today_pred = build_from_model(session_today, today_label, "today")
        tomorrow_pred = build_from_model(session_tomorrow, tomorrow_label, "tomorrow")
    else:
        today_pred = build_from_momentum(session_today, today_label, "today", max(1, steps_ahead(session_today)))
        tomorrow_pred = build_from_momentum(
            session_tomorrow, tomorrow_label, "tomorrow", max(2, steps_ahead(session_tomorrow))
        )

    return {
        "today": today_pred,
        "tomorrow": tomorrow_pred,
        "basisLastClose": round(last_close, 2),
        "basisDate": last_hist.isoformat(),
    }


def analyse_stock(exchange: str, symbol: str, horizon_days: int = 14) -> dict[str, Any]:
    horizon_days = max(3, min(int(horizon_days), 30))
    meta = find_symbol(exchange, symbol)
    name = meta["name"] if meta else symbol.upper()

    hist = download_history(exchange, symbol, period="max", min_rows=MIN_BARS)
    if hist is None or hist.empty or len(hist) < MIN_BARS:
        return {
            "exchange": exchange.upper(),
            "symbol": symbol.upper(),
            "name": name,
            "error": (
                "Not enough market history yet to analyse this stock. "
                "Newly listed names need a few trading sessions before signals are reliable."
            ),
            "disclaimer": DISCLAIMER,
        }

    close = hist["Close"].astype(float)
    n = len(close)
    sma20_v = _sma(close, 20)
    sma50_v = _sma(close, 50)
    sma200_v = _sma(close, 200)
    rsi = _rsi(close, 14 if n >= 20 else max(3, n // 2))
    macd = _macd(close)

    price = float(close.iloc[-1])
    lookback = min(n, 252)
    past = close.iloc[-lookback:]
    past_return = float((past.iloc[-1] / past.iloc[0] - 1) * 100) if len(past) > 1 else 0.0
    peak = float(past.max())
    trough = float(past.min())
    drawdown = float((price / peak - 1) * 100) if peak else 0.0

    signal, confidence, reasons = _score_signal(
        price,
        sma20_v,
        sma50_v,
        sma200_v,
        rsi,
        macd.get("histogram"),
        recent_return=past_return,
    )

    if n < 50:
        confidence = max(28, confidence - 20)
        reasons.insert(
            0,
            f"Limited history: only {n} trading day(s) available since listing — treat this signal as provisional.",
        )

    hist_points = [
        {"date": idx.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 2)}
        for idx, row in hist.iloc[-lookback:].iterrows()
    ]
    forecast = _forecast(close, hist.index, horizon_days)
    session_forecast = _session_close_forecast(close, hist.index)

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
        "barsUsed": n,
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
        "sessionForecast": session_forecast,
        "disclaimer": DISCLAIMER,
        "asOf": datetime.now(timezone.utc).isoformat(),
    }
