'use client'

import { useEffect, useState } from 'react'
import { listVideoFormats } from '@/actions/video-formats/list-video-formats'
import type { VideoFormat } from '@/lib/storyboard/formats'
import { toast } from 'sonner'

interface FormatSelectorProps {
  value?: string
  onChange: (formatKey: string) => void
}

/**
 * Picks the video type a project is written against.
 *
 * The list comes from the database, not from a constant: an organization sees
 * the shipped formats plus the ones it wrote, and an override appears in place
 * of the format it replaces.
 */
export function FormatSelector({ value, onChange }: FormatSelectorProps) {
  const [formats, setFormats] = useState<VideoFormat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    listVideoFormats().then((result) => {
      if (cancelled) return
      if (result.success && result.data) setFormats(result.data)
      else toast.error(result.error ?? 'Failed to load video formats')
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-border bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {formats.map((format) => {
        const isSelected = format.id === value
        return (
          <button
            key={format.id}
            type="button"
            onClick={() => onChange(format.id)}
            aria-pressed={isSelected}
            className={`p-4 border rounded-lg text-left transition-colors ${
              isSelected
                ? 'border-primary bg-primary/10'
                : 'border-border hover:bg-accent/50'
            }`}
          >
            <h3 className="font-semibold">{format.label}</h3>
            <p className="text-xs text-muted-foreground mt-1">{format.hint}</p>
            <p className="text-xs text-muted-foreground mt-2">
              ~{format.script.paragraphs} paragraphs
            </p>
          </button>
        )
      })}
    </div>
  )
}
