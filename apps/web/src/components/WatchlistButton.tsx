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
      ? 'h-8 w-8 justify-center rounded-lg p-0 text-sm sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-xl sm:px-2.5 sm:py-1 sm:text-[11px]'
      : 'gap-1.5 rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({ exchange, symbol, name })
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
      title={saved ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`inline-flex items-center border font-semibold transition ${sizing} ${
        saved
          ? 'border-coral/40 bg-coral/10 text-coral hover:bg-coral/15'
          : 'border-mist bg-white text-ink-soft hover:border-teal/40 hover:text-teal'
      } ${className}`}
    >
      <span aria-hidden="true">{saved ? '★' : '☆'}</span>
      {size === 'sm' ? (
        <span className="hidden sm:inline">{saved ? 'Saved' : 'Watch'}</span>
      ) : (
        <span>{saved ? 'In watchlist' : 'Add to watchlist'}</span>
      )}
    </button>
  )
}
