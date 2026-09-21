'use client'

import { useEffect, useState } from 'react'
import { listVideoFormats } from '@/actions/video-formats/list-video-formats'
import { BUILT_IN_FORMATS } from '@/lib/storyboard/formats'
import type { VideoFormat } from '@/lib/storyboard/formats'

interface UseVideoFormatsOptions {
  /**
   * When true, the hook starts with the shipped built-in formats so the picker
   * is never empty while the server round-trip happens. Set to false when you
   * only want to render once the real list is ready.
   */
  withFallback?: boolean
}

interface UseVideoFormatsResult {
  formats: readonly VideoFormat[]
  /** The format this organization starts new projects on, when it picked one. */
  defaultKey: string | null
  isLoading: boolean
}

/**
 * Loads the video formats this organization can write against.
 *
 * The list comes from the database: the shipped formats plus any the
 * organization added or overrode. The hook never throws; on failure it keeps
 * whatever initial value was set.
 */
export function useVideoFormats({ withFallback = false }: UseVideoFormatsOptions = {}): UseVideoFormatsResult {
  const [formats, setFormats] = useState<readonly VideoFormat[]>(
    withFallback ? BUILT_IN_FORMATS : [],
  )
  const [defaultKey, setDefaultKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    listVideoFormats().then((result) => {
      if (cancelled) return
      if (result.success && result.data?.length) {
        setFormats(result.data)
        setDefaultKey(result.defaultKey ?? null)
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { formats, defaultKey, isLoading }
}
