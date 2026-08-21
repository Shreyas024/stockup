# StockUp

NSE & BSE stock explorer with historical technical analysis and a short ML price forecast.

**Not financial advice.** Signals are educational estimates from past price patterns.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind + Recharts (`apps/web`)
- **Backend:** FastAPI + yfinance + scikit-learn (`apps/api`)
- **Data:** Symbol master in `data/symbols.json` (Yahoo tickers `.NS` / `.BO`)

## Run locally

### 1. API

```bash
cd apps/api
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Web

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to the FastAPI server.

## Features

- Home: trending movers / gainers / losers (liquid universe)
- Search across seeded NSE & BSE symbols
- Stock page: live-ish quote, OHLC stats, historical chart
- Analyse: Buy / Hold / Sell from SMA / RSI / MACD + ML forecast chart

## Expand the symbol list

Refresh the full NSE equity list (keeps liquid flags for trending):

```bash
cd apps/api
.\.venv\Scripts\python.exe ..\..\scripts\refresh_symbols.py
```

Edit `data/symbols.json` to mark more names with `"liquid": true` for the home trending panels. BSE entries are included for liquid/popular names (Yahoo `.BO` tickers).
