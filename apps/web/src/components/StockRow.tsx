import { Link } from 'react-router-dom'
import type { Quote } from '../lib/api'
import { formatPct, formatPrice } from '../lib/api'
import { WatchlistButton } from './WatchlistButton'

export function StockRow({ quote }: { quote: Quote }) {
  const up = (quote.changePercent ?? 0) >= 0
  return (
    <div className="group w-full min-w-0 max-w-full px-2 py-2.5 sm:px-3 sm:py-3">
      {/* Mobile: stacked so price never clips */}
      <div className="flex w-full min-w-0 flex-col gap-2 sm:hidden">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            to={`/stock/${quote.exchange}/${encodeURIComponent(quote.symbol)}`}
            className="min-w-0 flex-1 overflow-hidden"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">{quote.symbol}</span>
              <span className="shrink-0 rounded bg-mist/80 px-1 py-0.5 text-[9px] font-semibold uppercase text-ink-soft">
                {quote.exchange}
              </span>
            </div>
            <p className="truncate text-xs text-ink-soft/75">{quote.name}</p>
          </Link>
          <WatchlistButton
            exchange={quote.exchange}
            symbol={quote.symbol}
            name={quote.name}
            size="sm"
            className="shrink-0"
          />
        </div>
        <Link
          to={`/stock/${quote.exchange}/${encodeURIComponent(quote.symbol)}`}
          className="flex items-baseline justify-between gap-3 rounded-lg bg-mist/40 px-2.5 py-1.5"
        >
          <span className="text-sm font-semibold tabular-nums text-ink">
            ₹{formatPrice(quote.price)}
          </span>
          <span className={`text-xs font-medium tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
            {formatPct(quote.changePercent)}
          </span>
        </Link>
      </div>

      {/* Desktop / tablet: single row */}
      <div className="hidden min-w-0 items-center gap-3 sm:flex">
        <Link
          to={`/stock/${quote.exchange}/${encodeURIComponent(quote.symbol)}`}
          className="min-w-0 flex-1 overflow-hidden"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-ink group-hover:text-teal">{quote.symbol}</span>
            <span className="shrink-0 rounded bg-mist/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
              {quote.exchange}
            </span>
          </div>
          <p className="truncate text-sm text-ink-soft/75">{quote.name}</p>
        </Link>
        <div className="shrink-0 text-right">
          <div className="font-semibold tabular-nums">₹{formatPrice(quote.price)}</div>
          <div className={`text-sm tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
            {formatPct(quote.changePercent)}
          </div>
        </div>
        <WatchlistButton
          exchange={quote.exchange}
          symbol={quote.symbol}
          name={quote.name}
          size="sm"
          className="shrink-0"
        />
      </div>
    </div>
  )
}
