'use client'

import { useState } from 'react'
import type { TimelineClip } from '../types'
import { AnnotationsPanel } from './annotations-panel'

interface EditorWithAnnotationsProps {
  children: React.ReactNode
  timelineClips: TimelineClip[]
}

export function EditorWithAnnotations({
  children,
  timelineClips,
}: EditorWithAnnotationsProps) {
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

  const selectedClip = selectedClipId
    ? timelineClips.find((c) => c.id === selectedClipId) || null
    : null

  return (
    <div className="flex h-full w-full">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>

      {/* Annotations panel on the right */}
      <div className="w-80 border-l bg-background overflow-y-auto">
        <AnnotationsPanel selectedClip={selectedClip} />
      </div>
    </div>
  )
}
