'use client'

import { useEffect, useState } from 'react'
import { listVisualStyles } from '@/actions/visual-styles/list-visual-styles'
import { BUILT_IN_VISUAL_STYLES } from '@/lib/storyboard/visual-styles/built-in'
import type { VisualStyle } from '@/lib/storyboard/visual-styles/types'

interface UseVisualStylesOptions {
  /**
   * When true, the hook starts with the shipped built-in styles so the picker
   * is never empty while the server round-trip happens.
   */
  withFallback?: boolean
}

interface UseVisualStylesResult {
  styles: readonly VisualStyle[]
  /** The style this organization starts new projects on, when it picked one. */
  defaultKey: string | null
  isLoading: boolean
}

/**
 * Loads the visual styles this organization can pick from.
 *
 * The list comes from the database: the shipped styles plus any the
 * organization added or overrode. The hook never throws; on failure it keeps
 * whatever initial value was set.
 */
export function useVisualStyles({ withFallback = false }: UseVisualStylesOptions = {}): UseVisualStylesResult {
  const [styles, setStyles] = useState<readonly VisualStyle[]>(
    withFallback ? BUILT_IN_VISUAL_STYLES : [],
  )
  const [defaultKey, setDefaultKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    listVisualStyles().then((result) => {
      if (cancelled) return
      if (result.success && result.data?.length) {
        setStyles(result.data)
        setDefaultKey(result.defaultKey ?? null)
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { styles, defaultKey, isLoading }
}
