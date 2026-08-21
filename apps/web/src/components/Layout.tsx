import { type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useWatchlist } from '../hooks/useWatchlist'
import { StockSearchBox } from './StockSearchBox'

export function Layout({ children }: { children: ReactNode }) {
  const { count } = useWatchlist()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-teal/10 bg-foam/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-3xl tracking-tight text-ink transition group-hover:text-teal">
              StockUp
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-ink-soft/70 sm:inline">
              NSE · BSE
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/watchlist"
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-ink text-foam'
                    : 'text-ink-soft hover:bg-mist/80 hover:text-ink'
                }`
              }
            >
              My watchlist
              {count > 0 && (
                <span className="ml-1.5 rounded-md bg-coral/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </NavLink>
          </nav>

          <div className="ml-auto min-w-[12rem] flex-1 sm:max-w-md">
            <StockSearchBox variant="header" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-mist/80 py-6 text-center text-xs text-ink-soft/70">
        Educational use only · Not financial advice · Delayed / Yahoo-sourced market data
      </footer>
    </div>
  )
}
