import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  isOnWatchlist,
  loadWatchlist,
  saveWatchlist,
  watchlistKey,
  type WatchlistItem,
} from '../lib/watchlist'

type WatchlistContextValue = {
  items: WatchlistItem[]
  count: number
  has: (exchange: string, symbol: string) => boolean
  add: (item: { exchange: string; symbol: string; name: string }) => void
  remove: (exchange: string, symbol: string) => void
  toggle: (item: { exchange: string; symbol: string; name: string }) => void
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null)

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(() =>
    typeof window === 'undefined' ? [] : loadWatchlist(),
  )

  useEffect(() => {
    saveWatchlist(items)
  }, [items])

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'stockup.watchlist.v1') setItems(loadWatchlist())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const has = useCallback(
    (exchange: string, symbol: string) => isOnWatchlist(items, exchange, symbol),
    [items],
  )

  const add = useCallback((item: { exchange: string; symbol: string; name: string }) => {
    setItems((prev) => {
      if (isOnWatchlist(prev, item.exchange, item.symbol)) return prev
      return [
        {
          exchange: item.exchange.toUpperCase(),
          symbol: item.symbol.toUpperCase(),
          name: item.name,
          addedAt: new Date().toISOString(),
        },
        ...prev,
      ]
    })
  }, [])

  const remove = useCallback((exchange: string, symbol: string) => {
    const key = watchlistKey(exchange, symbol)
    setItems((prev) => prev.filter((i) => watchlistKey(i.exchange, i.symbol) !== key))
  }, [])

  const toggle = useCallback(
    (item: { exchange: string; symbol: string; name: string }) => {
      if (isOnWatchlist(items, item.exchange, item.symbol)) {
        remove(item.exchange, item.symbol)
      } else {
        add(item)
      }
    },
    [items, add, remove],
  )

  const value = useMemo(
    () => ({ items, count: items.length, has, add, remove, toggle }),
    [items, has, add, remove, toggle],
  )

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider')
  return ctx
}
