const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export type SymbolResult = {
  symbol: string
  name: string
  exchange: string
  liquid?: boolean
}

export type Quote = {
  exchange: string
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  open: number | null
  high: number | null
  low: number | null
  previousClose: number | null
  volume: number | null
  currency: string
  asOf: string
}

export type HistoryPoint = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type SessionClosePrediction = {
  kind: 'today' | 'tomorrow' | string
  label: string
  date: string
  weekday: string
  predicted: number
  low: number
  high: number
  vsLastClose: number
  vsLastClosePercent: number
}

export type AnalyseResult = {
  exchange: string
  symbol: string
  name: string
  signal?: 'Buy' | 'Hold' | 'Sell'
  confidence?: number
  reasons?: string[]
  currentPrice?: number
  horizonDays?: number
  trendSummary?: {
    label: string
    pastReturnPercent: number
    drawdownFromHighPercent: number
    yearHigh: number
    yearLow: number
  }
  indicators?: {
    sma20: number | null
    sma50: number | null
    sma200: number | null
    rsi: number | null
    macd: { macd: number | null; signal: number | null; histogram: number | null }
  }
  history?: { date: string; close: number }[]
  forecast?: { date: string; predicted: number; low: number; high: number }[]
  sessionForecast?: {
    today: SessionClosePrediction | null
    tomorrow: SessionClosePrediction | null
    basisLastClose?: number
    basisDate?: string
  }
  disclaimer: string
  error?: string
  asOf?: string
}

export const api = {
  search: (q: string) =>
    request<{ query: string; results: SymbolResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  trending: () =>
    request<{ movers: Quote[]; gainers: Quote[]; losers: Quote[]; asOf: string }>('/api/trending'),
  quote: (exchange: string, symbol: string) =>
    request<Quote>(`/api/quote/${exchange}/${encodeURIComponent(symbol)}`),
  history: (exchange: string, symbol: string, range = '1y') =>
    request<{ exchange: string; symbol: string; range: string; points: HistoryPoint[] }>(
      `/api/history/${exchange}/${encodeURIComponent(symbol)}?range=${range}`,
    ),
  analyse: (exchange: string, symbol: string, horizonDays = 14) =>
    request<AnalyseResult>('/api/analyse', {
      method: 'POST',
      body: JSON.stringify({ exchange, symbol, horizonDays }),
    }),
}

export function formatPrice(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function formatVolume(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`
  return n.toLocaleString('en-IN')
}
