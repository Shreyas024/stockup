import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PriceChart } from '../components/PriceChart'
import { formatUpdatedAt, useAutoRefresh } from '../hooks/useAutoRefresh'
import { api, formatPct, formatPrice, formatVolume, type HistoryPoint, type Quote } from '../lib/api'

const RANGES = [
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
] as const

const QUOTE_REFRESH_MS = 20_000

export function StockPage() {
  const { exchange = '', symbol = '' } = useParams()
  const decoded = decodeURIComponent(symbol)
  const [points, setPoints] = useState<HistoryPoint[]>([])
  const [range, setRange] = useState<string>('1y')
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const fetchQuote = useCallback(
    () => api.quote(exchange, decoded),
    [exchange, decoded],
  )

  const {
    data: quote,
    loading: quoteLoading,
    refreshing,
    error: quoteError,
    updatedAt,
  } = useAutoRefresh<Quote>(fetchQuote, QUOTE_REFRESH_MS, [exchange, decoded])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setHistoryLoading(true)
        const h = await api.history(exchange, decoded, range)
        if (cancelled) return
        setPoints(h.points)
        setHistoryError(null)
      } catch (e) {
        if (!cancelled) setHistoryError(e instanceof Error ? e.message : 'Failed to load history')
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [exchange, decoded, range])

  const up = (quote?.changePercent ?? 0) >= 0
  const chartData = points.map((p) => ({ date: p.date, close: p.close }))
  const error = quoteError || historyError
  const loading = (quoteLoading && !quote) || (historyLoading && points.length === 0)

  return (
    <div className="animate-rise space-y-8">
      {loading ? (
        <p className="animate-pulse-soft text-sm text-ink-soft/60">Loading market data…</p>
      ) : error && !quote ? (
        <p className="text-sm text-loss">{error}</p>
      ) : quote ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-4xl sm:text-5xl">{quote.symbol}</h1>
                <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {quote.exchange}
                </span>
              </div>
              <p className="mt-1 text-ink-soft/80">{quote.name}</p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <span className="text-3xl font-semibold tabular-nums">₹{formatPrice(quote.price)}</span>
                <span className={`text-lg font-medium tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
                  {formatPrice(quote.change)} ({formatPct(quote.changePercent)})
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-soft/55">
                {refreshing ? (
                  <span className="animate-pulse-soft text-teal">Updating price…</span>
                ) : updatedAt ? (
                  <>Live · last update {formatUpdatedAt(updatedAt)}</>
                ) : null}
              </p>
            </div>
            <Link
              to={`/stock/${exchange}/${encodeURIComponent(decoded)}/analyse`}
              className="rounded-xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ink"
            >
              Analyse stock
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Open" value={`₹${formatPrice(quote.open)}`} />
            <Stat label="High" value={`₹${formatPrice(quote.high)}`} />
            <Stat label="Low" value={`₹${formatPrice(quote.low)}`} />
            <Stat label="Prev close" value={`₹${formatPrice(quote.previousClose)}`} />
            <Stat label="Volume" value={formatVolume(quote.volume)} />
          </div>

          <section className="rounded-2xl border border-mist bg-white/80 p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft/70">
                Price history
              </h2>
              <div className="flex gap-1 rounded-lg bg-mist/60 p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRange(r.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      range === r.key ? 'bg-white text-teal shadow-sm' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart data={chartData} />
          </section>
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-mist bg-white/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/55">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}
