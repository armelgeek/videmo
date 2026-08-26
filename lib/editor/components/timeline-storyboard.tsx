"use client"

import type React from "react"
import { memo, useCallback } from "react"
import type { StoryboardPanel } from "../types"

interface TimelineStoryboardProps {
  panels: StoryboardPanel[]
  onPanelClick: (panel: StoryboardPanel, index: number) => void
}

export const TimelineStoryboard = memo(function TimelineStoryboard({
  panels,
  onPanelClick,
}: TimelineStoryboardProps) {
  const handlePanelClick = useCallback(
    (panel: StoryboardPanel, index: number) => {
      onPanelClick(panel, index)
    },
    [onPanelClick],
  )

  if (panels.length === 0) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <h3 className="text-sm font-semibold text-white">Storyboard Steps</h3>
        <p className="text-xs text-neutral-400">No storyboard steps yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-y-auto custom-scrollbar">
      <h3 className="text-sm font-semibold text-white sticky top-0 bg-[var(--surface-0)]">Storyboard Steps</h3>
      <div className="flex flex-col gap-2">
        {panels.map((panel, idx) => (
          <div
            key={panel.id}
            onClick={() => handlePanelClick(panel, idx)}
            className="group cursor-pointer rounded-lg overflow-hidden border border-[var(--border-default)] hover:border-[var(--accent-primary)] transition-all hover:shadow-lg hover:shadow-[var(--accent-primary)]/20"
          >
            {panel.imageUrl && (
              <div className="relative w-full aspect-video bg-neutral-900 overflow-hidden">
                <img
                  src={panel.imageUrl}
                  alt={`Step ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute top-1 right-1 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white font-medium">
                  {idx + 1}
                </div>
              </div>
            )}
            <div className="p-2 bg-neutral-900 border-t border-[var(--border-default)]">
              <p className="text-[11px] text-neutral-300 line-clamp-2">
                {panel.prompt || `Step ${idx + 1}`}
              </p>
              {panel.type && (
                <p className="text-[9px] text-neutral-500 mt-1">
                  {panel.type === "transition" ? "🔄 Transition" : "📸 Scene"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
