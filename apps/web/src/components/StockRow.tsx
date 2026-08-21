import { Link } from 'react-router-dom'
import type { Quote } from '../lib/api'
import { formatPct, formatPrice } from '../lib/api'
import { WatchlistButton } from './WatchlistButton'

export function StockRow({ quote }: { quote: Quote }) {
  const up = (quote.changePercent ?? 0) >= 0
  return (
    <div className="group flex items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-3 transition hover:border-mist hover:bg-white/70">
      <Link
        to={`/stock/${quote.exchange}/${encodeURIComponent(quote.symbol)}`}
        className="min-w-0 flex-1"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink group-hover:text-teal">{quote.symbol}</span>
          <span className="rounded bg-mist/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
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
        className="shrink-0 !px-2 !py-1"
      />
    </div>
  )
}
