import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-teal/10 bg-foam/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-3xl tracking-tight text-ink transition group-hover:text-teal">
              StockUp
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-ink-soft/70 sm:inline">
              NSE · BSE
            </span>
          </Link>
          <form onSubmit={onSubmit} className="ml-auto flex min-w-[12rem] flex-1 justify-end sm:max-w-md">
            <label className="relative w-full">
              <span className="sr-only">Search stocks</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search symbol or company…"
                className="w-full rounded-xl border border-mist bg-white/90 px-4 py-2.5 text-sm text-ink shadow-sm outline-none ring-teal/30 transition placeholder:text-ink-soft/45 focus:ring-2"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-foam transition hover:bg-teal"
              >
                Search
              </button>
            </label>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-mist/80 py-6 text-center text-xs text-ink-soft/70">
        Educational use only · Not financial advice · Delayed / Yahoo-sourced market data
      </footer>
    </div>
  )
}
