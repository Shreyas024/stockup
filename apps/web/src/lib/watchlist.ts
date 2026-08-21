export type WatchlistItem = {
  exchange: string
  symbol: string
  name: string
  addedAt: string
}

const STORAGE_KEY = 'stockup.watchlist.v1'

function readRaw(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WatchlistItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i) => i && typeof i.symbol === 'string' && typeof i.exchange === 'string',
    )
  } catch {
    return []
  }
}

function writeRaw(items: WatchlistItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function watchlistKey(exchange: string, symbol: string) {
  return `${exchange.toUpperCase()}:${symbol.toUpperCase()}`
}

export function loadWatchlist(): WatchlistItem[] {
  return readRaw()
}

export function saveWatchlist(items: WatchlistItem[]) {
  writeRaw(items)
}

export function isOnWatchlist(items: WatchlistItem[], exchange: string, symbol: string) {
  const key = watchlistKey(exchange, symbol)
  return items.some((i) => watchlistKey(i.exchange, i.symbol) === key)
}
