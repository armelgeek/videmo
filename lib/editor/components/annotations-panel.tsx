'use client'

import React from 'react'
import type { TimelineClip } from '../types'
import { useAnnotations } from '../hooks/use-annotations'
import { formatTime, getAbsoluteAnnotationTime } from '@/lib/utils/time'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'

interface AnnotationsPanelProps {
  selectedClip: TimelineClip | null
  onAddAnnotation?: () => void
}

export function AnnotationsPanel({
  selectedClip,
  onAddAnnotation,
}: AnnotationsPanelProps) {
  const { annotations, isLoading, deleteAnnotation } =
    useAnnotations(selectedClip?.id ?? null)

  if (!selectedClip) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Select a clip to view annotations
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 border-t">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Annotations</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={onAddAnnotation}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}

      {!isLoading && annotations.length === 0 && (
        <div className="text-sm text-muted-foreground">No annotations yet</div>
      )}

      <div className="space-y-2">
        {annotations.map((annotation) => {
          const absStart = getAbsoluteAnnotationTime(selectedClip, annotation.startMs)
          const absEnd = absStart + annotation.durationMs / 1000

          return (
            <div
              key={annotation.id}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{annotation.label}</p>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  <span>{formatTime(absStart)}</span>
                  <span>→</span>
                  <span>{formatTime(absEnd)}</span>
                </div>
                {annotation.narrativeRole && (
                  <p className="mt-1 text-xs">{annotation.narrativeRole}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteAnnotation(annotation.id)}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
