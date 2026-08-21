import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WatchlistButton } from '../components/WatchlistButton'
import { useWatchlist } from '../hooks/useWatchlist'
import { api, formatPct, formatPrice, type Quote } from '../lib/api'

export function WatchlistPage() {
  const { items } = useWatchlist()
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (items.length === 0) {
      setQuotes({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const results = await Promise.all(
          items.map(async (item) => {
            try {
              const q = await api.quote(item.exchange, item.symbol, true)
              return [`${item.exchange}:${item.symbol}`, q] as const
            } catch {
              return null
            }
          }),
        )
        if (cancelled) return
        const map: Record<string, Quote> = {}
        for (const row of results) {
          if (row) map[row[0]] = row[1]
        }
        setQuotes(map)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    const timer = setInterval(() => {
      void (async () => {
        const results = await Promise.all(
          items.map(async (item) => {
            try {
              const q = await api.quote(item.exchange, item.symbol, true)
              return [`${item.exchange}:${item.symbol}`, q] as const
            } catch {
              return null
            }
          }),
        )
        if (cancelled) return
        setQuotes((prev) => {
          const next = { ...prev }
          for (const row of results) {
            if (row) next[row[0]] = row[1]
          }
          return next
        })
      })()
    }, 8000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [items])

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="font-display text-4xl text-ink">My watchlist</h1>
        <p className="mt-2 text-ink-soft/80">
          Stocks you save are kept in this browser. {items.length} saved.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-mist bg-white/70 px-5 py-10 text-center">
          <p className="text-ink-soft/75">Your watchlist is empty.</p>
          <Link to="/search?q=RELIANCE" className="mt-3 inline-block text-sm font-semibold text-teal hover:underline">
            Search stocks to add →
          </Link>
        </div>
      ) : (
        <ul className="w-full min-w-0 divide-y divide-mist overflow-hidden rounded-2xl border border-mist bg-white/80">
          {items.map((item) => {
            const key = `${item.exchange}:${item.symbol}`
            const quote = quotes[key]
            const up = (quote?.changePercent ?? 0) >= 0
            return (
              <li key={key} className="flex w-full min-w-0 flex-col gap-2 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 sm:py-3.5">
                <div className="flex min-w-0 items-start gap-2 sm:flex-1">
                  <Link
                    to={`/stock/${item.exchange}/${encodeURIComponent(item.symbol)}`}
                    className="min-w-0 flex-1 overflow-hidden"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-ink hover:text-teal">{item.symbol}</span>
                      <span className="shrink-0 rounded bg-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                        {item.exchange}
                      </span>
                    </div>
                    <p className="truncate text-sm text-ink-soft/75">{item.name}</p>
                  </Link>
                  <WatchlistButton
                    exchange={item.exchange}
                    symbol={item.symbol}
                    name={item.name}
                    size="sm"
                    className="shrink-0 sm:hidden"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:contents">
                  <div className="text-left sm:ml-auto sm:text-right">
                    {loading && !quote ? (
                      <span className="text-xs text-ink-soft/50">…</span>
                    ) : (
                      <>
                        <div className="font-semibold tabular-nums">₹{formatPrice(quote?.price ?? null)}</div>
                        <div className={`text-sm tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
                          {formatPct(quote?.changePercent ?? null)}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/stock/${item.exchange}/${encodeURIComponent(item.symbol)}/analyse`}
                      className="rounded-lg bg-coral/10 px-2.5 py-1.5 text-xs font-semibold text-coral hover:bg-coral/15"
                    >
                      Analyse
                    </Link>
                    <WatchlistButton
                      exchange={item.exchange}
                      symbol={item.symbol}
                      name={item.name}
                      size="sm"
                      className="hidden sm:inline-flex"
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
