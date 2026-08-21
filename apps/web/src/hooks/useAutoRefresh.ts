import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Polls `fn` immediately and on an interval while the tab is visible.
 * Subsequent runs do not flip `loading` so the UI stays stable.
 */
export function useAutoRefresh<T>(
  fn: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (isInitial: boolean) => {
    try {
      if (isInitial) setLoading(true)
      else setRefreshing(true)
      const result = await fnRef.current()
      setData(result)
      setError(null)
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, deps) // intentional: caller-supplied identity for refetch

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    const tick = (initial: boolean) => {
      if (cancelled) return
      if (document.visibilityState === 'hidden') return
      void run(initial)
    }

    tick(true)
    timer = setInterval(() => tick(false), intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick(false)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [run, intervalMs])

  return { data, loading, refreshing, error, updatedAt }
}

export function formatUpdatedAt(date: Date | null) {
  if (!date) return ''
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
