'use client'

import { useEffect, useState } from 'react'

interface ListResult<T> {
  success: boolean
  data?: T[]
  defaultKey?: string | null
}

interface PickerCollection<T> {
  items: readonly T[]
  /** What the organization starts new projects on, null while ours stands. */
  defaultKey: string | null
  isLoading: boolean
}

/**
 * A picker's list, read from the database once the page is up.
 *
 * Formats and styles are the same story: the rows shipped with the product,
 * plus whatever the organization wrote or overrode, plus which of them it
 * starts from. The shipped ones seed the state so a picker is never empty
 * while the round-trip happens, and a failed call simply leaves them there.
 */
export function usePickerCollection<T>(
  fetchList: () => Promise<ListResult<T>>,
  shipped: readonly T[],
): PickerCollection<T> {
  const [items, setItems] = useState<readonly T[]>(shipped)
  const [defaultKey, setDefaultKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchList().then((result) => {
      if (cancelled) return
      if (result.success && result.data?.length) {
        setItems(result.data)
        setDefaultKey(result.defaultKey ?? null)
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [fetchList])

  return { items, defaultKey, isLoading }
}
