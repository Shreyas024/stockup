import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StockRow } from '../components/StockRow'
import { formatUpdatedAt, useAutoRefresh } from '../hooks/useAutoRefresh'
import { api, type Quote } from '../lib/api'

const REFRESH_MS = 30_000

export function HomePage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const { data, loading, refreshing, error, updatedAt } = useAutoRefresh(
    () => api.trending(),
    REFRESH_MS,
  )

  const movers = data?.movers ?? []
  const gainers = data?.gainers ?? []
  const losers = data?.losers ?? []

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="space-y-12">
      <section className="animate-rise grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-teal">
            Historical patterns · Forward outlook
          </p>
          <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
            StockUp
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft/85">
            Explore NSE &amp; BSE equities, read current market moves, and analyse past ups and downs
            for a Buy / Hold / Sell outlook with a short predicted trend.
          </p>
          <form onSubmit={onSearch} className="mt-8 flex max-w-xl gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try RELIANCE, TCS, HDFCBANK…"
              className="flex-1 rounded-xl border border-mist bg-white px-4 py-3 text-sm shadow-sm outline-none ring-teal/30 focus:ring-2"
            />
            <button
              type="submit"
              className="rounded-xl bg-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink"
            >
              Find stock
            </button>
          </form>
        </div>
        <div className="animate-rise-delay relative overflow-hidden rounded-3xl border border-mist bg-ink px-6 py-7 text-foam shadow-lg">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-teal-bright/30 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-bright">Today&apos;s pulse</p>
          <p className="mt-3 font-display text-3xl leading-snug">
            Trending names moving the most across liquid NSE &amp; BSE names.
          </p>
          <p className="mt-3 text-sm text-foam/70">
            Pick a stock, open the chart, then run Analyse for technical signals plus a forecast path.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft/70">
          Live trending
        </h2>
        <p className="text-xs text-ink-soft/55">
          {refreshing ? (
            <span className="animate-pulse-soft text-teal">Updating…</span>
          ) : updatedAt ? (
            <>Auto-refresh · last update {formatUpdatedAt(updatedAt)}</>
          ) : (
            'Auto-refresh every 30s'
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">
          {error}. Is the API running on port 8000?
        </div>
      )}

      {loading && !data ? (
        <div className="animate-pulse-soft rounded-2xl border border-mist bg-white/50 px-4 py-16 text-center text-sm text-ink-soft/60">
          Loading trending stocks…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <TrendingPanel title="Biggest movers" items={movers} />
          <TrendingPanel title="Top gainers" items={gainers} />
          <TrendingPanel title="Top losers" items={losers} />
        </div>
      )}

      <section className="rounded-2xl border border-mist bg-white/60 px-5 py-6 text-sm text-ink-soft/80">
        <p>
          StockUp scores historical trend strength (moving averages, RSI, MACD) and overlays a simple
          machine-learning price path. It is <strong className="text-ink">not financial advice</strong>.
          Always do your own research.{' '}
          <Link to="/search?q=RELIANCE" className="font-semibold text-teal hover:underline">
            Browse a sample stock →
          </Link>
        </p>
      </section>
    </div>
  )
}

function TrendingPanel({ title, items }: { title: string; items: Quote[] }) {
  return (
    <section className="rounded-2xl border border-mist bg-white/75 p-2 shadow-sm">
      <h2 className="px-3 pb-1 pt-3 text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft/70">
        {title}
      </h2>
      <div className="divide-y divide-mist/70">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-sm text-ink-soft/55">No data right now</p>
        ) : (
          items.slice(0, 6).map((q) => <StockRow key={`${q.exchange}-${q.symbol}`} quote={q} />)
        )}
      </div>
    </section>
  )
}
