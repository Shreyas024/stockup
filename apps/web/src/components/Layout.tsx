import { type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useWatchlist } from '../hooks/useWatchlist'
import { StockSearchBox } from './StockSearchBox'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:px-3 sm:text-sm ${
    isActive ? 'bg-ink text-foam' : 'text-ink-soft hover:bg-mist/80 hover:text-ink'
  }`

export function Layout({ children }: { children: ReactNode }) {
  const { count } = useWatchlist()

  return (
    <div className="min-h-screen w-full max-w-[100vw]">
      <header className="sticky top-0 z-40 border-b border-teal/10 bg-foam/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2.5 px-3 py-2.5 md:flex-nowrap md:gap-4 md:px-6 md:py-3">
          <Link to="/" className="group flex shrink-0 items-baseline gap-2">
            <span className="font-display text-2xl tracking-tight text-ink transition group-hover:text-teal md:text-3xl">
              StockUp
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-ink-soft/70 lg:inline">
              NSE · BSE
            </span>
          </Link>

          <nav className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-2">
            <NavLink to="/guide" className={navClass}>
              <span className="md:hidden">Guide</span>
              <span className="hidden md:inline">How to use</span>
            </NavLink>
            <NavLink to="/watchlist" className={navClass}>
              <span className="md:hidden">List</span>
              <span className="hidden md:inline">My watchlist</span>
              {count > 0 && (
                <span className="ml-1 rounded-md bg-coral/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </NavLink>
          </nav>

          <div className="min-w-0 basis-full md:ml-auto md:max-w-md md:flex-1 md:basis-auto">
            <StockSearchBox variant="header" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-mist/80 px-3 py-5 text-center text-[11px] leading-relaxed text-ink-soft/70 sm:py-6 sm:text-xs">
        Educational use only · Not financial advice · Delayed / Yahoo-sourced market data
      </footer>
    </div>
  )
}
