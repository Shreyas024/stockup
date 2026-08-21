import { Link } from 'react-router-dom'
import type { Quote } from '../lib/api'
import { formatPct, formatPrice } from '../lib/api'

export function StockRow({ quote }: { quote: Quote }) {
  const up = (quote.changePercent ?? 0) >= 0
  return (
    <Link
      to={`/stock/${quote.exchange}/${encodeURIComponent(quote.symbol)}`}
      className="group flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-mist hover:bg-white/70"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink group-hover:text-teal">{quote.symbol}</span>
          <span className="rounded bg-mist/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            {quote.exchange}
          </span>
        </div>
        <p className="truncate text-sm text-ink-soft/75">{quote.name}</p>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums">₹{formatPrice(quote.price)}</div>
        <div className={`text-sm tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
          {formatPct(quote.changePercent)}
        </div>
      </div>
    </Link>
  )
}
