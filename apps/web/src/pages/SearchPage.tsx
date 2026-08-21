import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type SymbolResult } from '../lib/api'

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [results, setResults] = useState<SymbolResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await api.search(q)
        if (!cancelled) {
          setResults(data.results)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [q])

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="font-display text-4xl text-ink">Search</h1>
        <p className="mt-2 text-ink-soft/80">
          Results for <span className="font-semibold text-ink">&ldquo;{q}&rdquo;</span>
        </p>
      </div>

      {loading && <p className="animate-pulse-soft text-sm text-ink-soft/60">Searching…</p>}
      {error && <p className="text-sm text-loss">{error}</p>}

      {!loading && !error && results.length === 0 && (
        <p className="rounded-xl border border-mist bg-white/60 px-4 py-8 text-sm text-ink-soft/65">
          No matching NSE/BSE symbols. Try another name or ticker.
        </p>
      )}

      <ul className="divide-y divide-mist overflow-hidden rounded-2xl border border-mist bg-white/75">
        {results.map((r) => (
          <li key={`${r.exchange}-${r.symbol}`}>
            <Link
              to={`/stock/${r.exchange}/${encodeURIComponent(r.symbol)}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-mist/40"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.symbol}</span>
                  <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                    {r.exchange}
                  </span>
                </div>
                <p className="text-sm text-ink-soft/75">{r.name}</p>
              </div>
              <span className="text-sm font-medium text-teal">View →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
