import { useWatchlist } from '../hooks/useWatchlist'

type Props = {
  exchange: string
  symbol: string
  name: string
  size?: 'sm' | 'md'
  className?: string
}

export function WatchlistButton({ exchange, symbol, name, size = 'md', className = '' }: Props) {
  const { has, toggle } = useWatchlist()
  const saved = has(exchange, symbol)

  const sizing =
    size === 'sm'
      ? 'px-2.5 py-1 text-[11px]'
      : 'px-4 py-2.5 text-sm'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({ exchange, symbol, name })
      }}
      aria-pressed={saved}
      className={`inline-flex items-center gap-1.5 rounded-xl border font-semibold transition ${sizing} ${
        saved
          ? 'border-coral/40 bg-coral/10 text-coral hover:bg-coral/15'
          : 'border-mist bg-white text-ink-soft hover:border-teal/40 hover:text-teal'
      } ${className}`}
    >
      <span aria-hidden="true">{saved ? '★' : '☆'}</span>
      {size === 'sm' ? (saved ? 'Saved' : 'Watch') : saved ? 'In watchlist' : 'Add to watchlist'}
    </button>
  )
}
