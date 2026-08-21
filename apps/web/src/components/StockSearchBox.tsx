import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, type SymbolResult } from '../lib/api'

type Props = {
  placeholder?: string
  variant?: 'header' | 'hero'
  className?: string
}

export function StockSearchBox({
  placeholder = 'Search symbol or company…',
  variant = 'header',
  className = '',
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suppressOpenRef = useRef(false)
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState<SymbolResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  function closeDropdown(clearQuery = false) {
    suppressOpenRef.current = true
    setOpen(false)
    setSuggestions([])
    setActiveIndex(-1)
    setLoading(false)
    if (clearQuery) setQ('')
    inputRef.current?.blur()
  }

  // Always close suggestions when the route changes (e.g. after picking a stock)
  useEffect(() => {
    closeDropdown(true)
  }, [location.pathname, location.search])

  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setLoading(false)
      setActiveIndex(-1)
      return
    }

    if (suppressOpenRef.current) {
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await api.search(trimmed)
          if (cancelled || suppressOpenRef.current) return
          setSuggestions(data.results.slice(0, 8))
          setOpen(true)
          setActiveIndex(-1)
        } catch {
          if (!cancelled) setSuggestions([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function goSearchPage(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return
    closeDropdown(true)
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  function goStock(item: SymbolResult) {
    closeDropdown(true)
    navigate(`/stock/${item.exchange}/${encodeURIComponent(item.symbol)}`)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      goStock(suggestions[activeIndex])
      return
    }
    goSearchPage(q)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const visible = open && q.trim().length >= 2

  const inputClass =
    variant === 'hero'
      ? 'w-full rounded-xl border border-mist bg-white px-3 py-2.5 pr-[4.25rem] text-sm shadow-sm outline-none ring-teal/30 focus:ring-2 sm:px-4 sm:py-3 sm:pr-28'
      : 'w-full rounded-lg border border-mist bg-white/90 px-3 py-2 pr-[4.25rem] text-sm text-ink shadow-sm outline-none ring-teal/30 transition placeholder:text-ink-soft/45 focus:ring-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:pr-24 sm:text-sm'

  const buttonClass =
    variant === 'hero'
      ? 'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ink sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm'
      : 'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-foam transition hover:bg-teal sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-xs'

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <form onSubmit={onSubmit}>
        <label className="relative block w-full">
          <span className="sr-only">Search stocks</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              suppressOpenRef.current = false
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              if (suppressOpenRef.current) return
              if (q.trim().length >= 2 && suggestions.length > 0) setOpen(true)
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={inputClass}
            role="combobox"
            aria-expanded={visible}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
          />
          <button type="submit" className={buttonClass}>
            {variant === 'hero' ? (
              <>
                <span className="sm:hidden">Find</span>
                <span className="hidden sm:inline">Find stock</span>
              </>
            ) : (
              'Search'
            )}
          </button>
        </label>
      </form>

      {visible && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1.5 max-h-80 w-full max-w-full overflow-auto rounded-xl border border-mist bg-white shadow-lg"
        >
          {loading && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-soft/60">Searching…</p>
          )}
          {!loading && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-soft/60">No matching stocks</p>
          )}
          {suggestions.map((item, index) => (
            <button
              key={`${item.exchange}-${item.symbol}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goStock(item)}
              className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${
                index === activeIndex ? 'bg-mist/70' : 'hover:bg-mist/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{item.symbol}</span>
                  <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                    {item.exchange}
                  </span>
                </div>
                <p className="truncate text-sm text-ink-soft/75">{item.name}</p>
              </div>
            </button>
          ))}
          {suggestions.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goSearchPage(q)}
              className="w-full border-t border-mist px-4 py-2.5 text-left text-sm font-semibold text-teal hover:bg-mist/40"
            >
              See all results for “{q.trim()}” →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
