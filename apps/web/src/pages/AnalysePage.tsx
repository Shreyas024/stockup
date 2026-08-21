import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PriceChart } from '../components/PriceChart'
import { api, formatPct, formatPrice, type AnalyseResult } from '../lib/api'

export function AnalysePage() {
  const { exchange = '', symbol = '' } = useParams()
  const decoded = decodeURIComponent(symbol)
  const [data, setData] = useState<AnalyseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [horizon, setHorizon] = useState(14)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const result = await api.analyse(exchange, decoded, horizon)
        if (cancelled) return
        setData(result)
        setError(result.error ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Analysis failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [exchange, decoded, horizon])

  const chartData = useMemo(() => {
    if (!data?.history) return []
    const hist = data.history.map((h) => ({
      date: h.date,
      close: h.close,
      predicted: undefined as number | undefined,
      low: undefined as number | undefined,
      high: undefined as number | undefined,
    }))
    const lastClose = hist[hist.length - 1]
    const forecast = (data.forecast ?? []).map((f) => ({
      date: f.date,
      close: undefined as number | undefined,
      predicted: f.predicted,
      low: f.low,
      high: f.high,
    }))
    // Bridge: attach first predicted to last historical point for visual continuity
    if (lastClose && forecast.length) {
      lastClose.predicted = lastClose.close
      lastClose.low = lastClose.close
      lastClose.high = lastClose.close
    }
    return [...hist, ...forecast]
  }, [data])

  const signalColor =
    data?.signal === 'Buy' ? 'text-gain bg-gain/10 border-gain/25' :
    data?.signal === 'Sell' ? 'text-loss bg-loss/10 border-loss/25' :
    'text-coral bg-coral/10 border-coral/25'

  return (
    <div className="animate-rise space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={`/stock/${exchange}/${encodeURIComponent(decoded)}`}
            className="text-sm font-medium text-teal hover:underline"
          >
            ← Back to quote
          </Link>
          <h1 className="mt-2 font-display text-4xl">
            Analyse {decoded}
            <span className="ml-2 text-2xl text-ink-soft/60">{exchange}</span>
          </h1>
          {data?.name && <p className="mt-1 text-ink-soft/80">{data.name}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Forecast horizon
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="rounded-lg border border-mist bg-white px-2 py-1.5 text-ink outline-none"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={21}>21 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
      </div>

      {loading && (
        <p className="animate-pulse-soft rounded-xl border border-mist bg-white/60 px-4 py-10 text-center text-sm text-ink-soft/60">
          Running technical + ML analysis on historical data…
        </p>
      )}

      {error && !loading && (
        <p className="rounded-xl border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">{error}</p>
      )}

      {!loading && data && !data.error && (
        <>
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className={`rounded-2xl border px-5 py-6 ${signalColor}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Suggestion</p>
              <p className="mt-2 font-display text-5xl">{data.signal}</p>
              <p className="mt-2 text-sm font-medium">
                Confidence {data.confidence}% · Spot ₹{formatPrice(data.currentPrice)}
              </p>
              {data.trendSummary && (
                <p className="mt-4 text-sm opacity-90">
                  Past trend: <strong>{data.trendSummary.label}</strong> (
                  {formatPct(data.trendSummary.pastReturnPercent)} over ~1y). Drawdown from high:{' '}
                  {formatPct(data.trendSummary.drawdownFromHighPercent)}.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-mist bg-white/80 px-5 py-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft/70">
                Why this signal
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft/90">
                {(data.reasons ?? []).map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="rounded-2xl border border-mist bg-white/80 p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft/70">
              Past price vs predicted trend
            </h2>
            <PriceChart data={chartData} showForecast />
            <p className="mt-3 text-xs text-ink-soft/60">
              Solid teal = historical close. Dashed coral = ML forecast with confidence band.
            </p>
          </section>

          {data.indicators && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="SMA 20" value={`₹${formatPrice(data.indicators.sma20)}`} />
              <Metric label="SMA 50" value={`₹${formatPrice(data.indicators.sma50)}`} />
              <Metric label="SMA 200" value={`₹${formatPrice(data.indicators.sma200)}`} />
              <Metric label="RSI (14)" value={data.indicators.rsi?.toFixed(1) ?? '—'} />
              <Metric
                label="MACD hist"
                value={data.indicators.macd.histogram?.toFixed(3) ?? '—'}
              />
            </div>
          )}

          <aside className="rounded-xl border border-coral/25 bg-coral/5 px-4 py-3 text-sm text-ink-soft">
            {data.disclaimer}
          </aside>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-mist bg-white/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/55">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
