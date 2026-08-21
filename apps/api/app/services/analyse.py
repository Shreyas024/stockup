"""Technical analysis + simple ML price forecast."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge

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


def _next_trading_days(after: date, count: int) -> list[date]:
    out: list[date] = []
    d = after
    while len(out) < count:
        d += timedelta(days=1)
        if d.weekday() < 5:
            out.append(d)
    return out


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


def _build_feature_frame(closes: pd.Series, volumes: pd.Series | None = None) -> pd.DataFrame:
    """Engineered features for next-day return prediction."""
    c = closes.astype(float)
    df = pd.DataFrame({"close": c})
    df["ret1"] = c.pct_change()
    df["ret2"] = c.pct_change(2)
    df["ret3"] = c.pct_change(3)
    df["ret5"] = c.pct_change(5)
    df["ret10"] = c.pct_change(10)
    df["sma5"] = c.rolling(5).mean() / c - 1
    df["sma10"] = c.rolling(10).mean() / c - 1
    df["sma20"] = c.rolling(20).mean() / c - 1
    df["sma50"] = c.rolling(50).mean() / c - 1
    df["ema12"] = c.ewm(span=12, adjust=False).mean() / c - 1
    df["ema26"] = c.ewm(span=26, adjust=False).mean() / c - 1
    df["vol5"] = df["ret1"].rolling(5).std()
    df["vol10"] = df["ret1"].rolling(10).std()
    df["vol20"] = df["ret1"].rolling(20).std()
    # RSI-ish
    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi"] = (100 - (100 / (1 + rs))) / 100.0
    df["mom5"] = c / c.shift(5) - 1
    df["mom10"] = c / c.shift(10) - 1
    if volumes is not None and len(volumes) == len(c):
        v = volumes.astype(float).replace(0, np.nan)
        df["vchg"] = v.pct_change()
        df["v_sma5"] = v / v.rolling(5).mean() - 1
    else:
        df["vchg"] = 0.0
        df["v_sma5"] = 0.0
    df["dow"] = np.array([idx.weekday() / 4.0 for idx in c.index], dtype=float)
    df["target"] = df["ret1"].shift(-1)  # next-day return
    return df


def _train_return_model(closes: pd.Series, volumes: pd.Series | None = None):
    """Train a fast ensemble that predicts next-day return."""
    # Keep training window bounded for speed on long histories
    max_bars = 400
    if len(closes) > max_bars:
        closes = closes.iloc[-max_bars:]
        if volumes is not None:
            volumes = volumes.iloc[-max_bars:]

    if len(closes) < 40:
        return None
    df = _build_feature_frame(closes, volumes)
    feature_cols = [c for c in df.columns if c not in {"close", "target"}]
    train = df.dropna()
    if len(train) < 30:
        return None

    X = train[feature_cols].values
    y = train["target"].values
    split = max(20, int(len(train) * 0.85))
    X_tr, y_tr = X[:split], y[:split]
    X_te, y_te = X[split:], y[split:]

    models = [
        GradientBoostingRegressor(
            n_estimators=80,
            max_depth=3,
            learning_rate=0.06,
            subsample=0.85,
            random_state=42,
        ),
        Ridge(alpha=1.0),
    ]
    fitted = []
    for m in models:
        try:
            m.fit(X_tr, y_tr)
            fitted.append(m)
        except Exception:
            continue
    if not fitted:
        return None

    def predict_row(row_vals: np.ndarray) -> float:
        preds = [float(m.predict(row_vals.reshape(1, -1))[0]) for m in fitted]
        blended = float(np.mean(preds))
        return float(np.clip(blended, -0.08, 0.08))

    if len(X_te) > 0:
        # Vectorized residual estimate from first model + ridge average
        te_stack = np.column_stack([m.predict(X_te) for m in fitted])
        te_preds = np.clip(te_stack.mean(axis=1), -0.08, 0.08)
        resid = y_te - te_preds
        std = float(np.std(resid)) if len(resid) else 0.015
    else:
        std = 0.015
    std = max(std, 0.008)

    latest = df.iloc[[-1]][feature_cols]
    if latest.isna().to_numpy().any():
        latest = latest.fillna(0.0)
    next_ret = predict_row(latest.values[0])

    return next_ret, std, feature_cols, fitted, df


def _ensemble_path(
    closes: pd.Series,
    dates: pd.DatetimeIndex,
    horizon_days: int,
    volumes: pd.Series | None = None,
) -> list[dict[str, Any]]:
    """Multi-step forecast using ML next-day return + EMA momentum blend."""
    last_price = float(closes.iloc[-1])
    last_ts = dates[-1].to_pydatetime()
    if last_ts.tzinfo is not None:
        last_ts = last_ts.astimezone(IST)
    sessions = _next_trading_days(last_ts.date(), horizon_days)

    trained = _train_return_model(closes, volumes)
    rets = closes.pct_change().dropna()
    ema_ret = float(rets.ewm(span=5).mean().iloc[-1]) if len(rets) else 0.0
    mean_ret = float(rets.tail(10).mean()) if len(rets) else 0.0
    vol = float(rets.tail(20).std()) if len(rets) > 5 else 0.02
    vol = max(vol if not np.isnan(vol) else 0.02, 0.01)

    if trained is not None:
        next_ret, ml_std, _, _, _ = trained
        day1 = 0.55 * next_ret + 0.25 * ema_ret + 0.20 * mean_ret
        std = max(ml_std, vol * 0.7)
    else:
        day1 = 0.6 * ema_ret + 0.4 * mean_ret
        std = vol

    day1 = float(np.clip(day1, -0.08, 0.08))
    # Mean-revert subsequent days toward milder drift
    drift = 0.35 * day1 + 0.65 * mean_ret
    drift = float(np.clip(drift, -0.04, 0.04))

    out: list[dict[str, Any]] = []
    price = last_price
    for i, session in enumerate(sessions, start=1):
        step_ret = day1 if i == 1 else drift * (0.85 ** (i - 2))
        price = price * (1 + step_ret)
        band = price * std * (1 + 0.12 * i) * 1.28
        out.append(
            {
                "date": session.isoformat(),
                "predicted": round(price, 2),
                "low": round(max(price - band, 0), 2),
                "high": round(price + band, 2),
            }
        )
    return out


def _forecast(
    closes: pd.Series,
    dates: pd.DatetimeIndex,
    horizon_days: int,
    volumes: pd.Series | None = None,
) -> list[dict[str, Any]]:
    if len(closes) < 8:
        return _momentum_forecast(closes, dates, horizon_days)
    return _ensemble_path(closes, dates, horizon_days, volumes)


def _close_on_date(closes: pd.Series, dates: pd.DatetimeIndex, target: date) -> float | None:
    for idx, px in zip(dates, closes):
        ts = idx.to_pydatetime()
        if ts.tzinfo is not None:
            ts = ts.astimezone(IST)
        if ts.date() == target:
            return float(px)
    return None


def _session_close_forecast(
    closes: pd.Series,
    dates: pd.DatetimeIndex,
    volumes: pd.Series | None = None,
) -> dict[str, Any]:
    last_ts = dates[-1].to_pydatetime()
    if last_ts.tzinfo is not None:
        last_ts = last_ts.astimezone(IST)
    last_hist = last_ts.date()
    last_close = float(closes.iloc[-1])

    now = datetime.now(IST)
    today = now.date()
    market_closed = now.hour > 15 or (now.hour == 15 and now.minute >= 30)

    if today.weekday() < 5:
        session_today = today
    else:
        session_today = _next_trading_days(today, 1)[0]
    session_tomorrow = _next_trading_days(session_today, 1)[0]

    path = _ensemble_path(closes, dates, 5, volumes) if len(closes) >= 8 else _momentum_forecast(closes, dates, 5)

    def pack(target: date, label: str, kind: str, predicted: float, low: float, high: float, is_actual: bool) -> dict[str, Any]:
        # vs previous completed close (day before target if available)
        change = round(predicted - last_close, 2)
        change_pct = round((change / last_close) * 100, 2) if last_close else 0.0
        return {
            "kind": kind,
            "label": label,
            "date": target.isoformat(),
            "weekday": target.strftime("%A"),
            "predicted": round(predicted, 2),
            "low": round(low, 2),
            "high": round(high, 2),
            "vsLastClose": change,
            "vsLastClosePercent": change_pct,
            "isActual": is_actual,
        }

    # TODAY: if Yahoo already has today's bar (usual after market close), show actual close
    actual_today = _close_on_date(closes, dates, session_today)
    if actual_today is not None and (market_closed or last_hist >= session_today):
        today_label = "Today's close (actual)"
        band = actual_today * 0.005
        today_pred = pack(
            session_today,
            today_label,
            "today",
            actual_today,
            actual_today - band,
            actual_today + band,
            True,
        )
        # Tomorrow = first step of ML path from known close
        if path:
            # Recompute path anchored at actual today by scaling from last_close ratio
            tmr = path[0]
            # If last bar is today, path[0] is already next session from today
            if last_hist >= session_today:
                tomorrow_pred = pack(
                    session_tomorrow,
                    "Predicted close tomorrow"
                    if session_tomorrow == today + timedelta(days=1)
                    else f"Predicted close tomorrow · {session_tomorrow.strftime('%A, %d %b')}",
                    "tomorrow",
                    tmr["predicted"],
                    tmr["low"],
                    tmr["high"],
                    False,
                )
            else:
                tomorrow_pred = pack(
                    session_tomorrow,
                    "Predicted close tomorrow",
                    "tomorrow",
                    tmr["predicted"],
                    tmr["low"],
                    tmr["high"],
                    False,
                )
        else:
            tomorrow_pred = pack(
                session_tomorrow,
                "Predicted close tomorrow",
                "tomorrow",
                actual_today,
                actual_today * 0.98,
                actual_today * 1.02,
                False,
            )
    else:
        # Before close / no today bar yet: ML prediction for today then tomorrow
        today_label = "Predicted close today"
        if path:
            t0 = path[0]
            today_pred = pack(session_today, today_label, "today", t0["predicted"], t0["low"], t0["high"], False)
            t1 = path[1] if len(path) > 1 else path[0]
            tomorrow_label = (
                "Predicted close tomorrow"
                if session_tomorrow == today + timedelta(days=1)
                else f"Predicted close tomorrow · {session_tomorrow.strftime('%A, %d %b')}"
            )
            tomorrow_pred = pack(
                session_tomorrow, tomorrow_label, "tomorrow", t1["predicted"], t1["low"], t1["high"], False
            )
        else:
            today_pred = pack(
                session_today, today_label, "today", last_close, last_close * 0.98, last_close * 1.02, False
            )
            tomorrow_pred = pack(
                session_tomorrow,
                "Predicted close tomorrow",
                "tomorrow",
                last_close,
                last_close * 0.97,
                last_close * 1.03,
                False,
            )

    return {
        "today": today_pred,
        "tomorrow": tomorrow_pred,
        "basisLastClose": round(last_close, 2),
        "basisDate": last_hist.isoformat(),
        "model": "gradient-boosting-ensemble",
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
    vol = hist["Volume"].astype(float) if "Volume" in hist.columns else None
    forecast = _forecast(close, hist.index, horizon_days, vol)
    session_forecast = _session_close_forecast(close, hist.index, vol)

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
