"use client"

import type React from "react"
import { memo, useState, useCallback } from "react"
import type { StoryboardPanel } from "../types"
import { PanelLeftClose } from "./icons"

interface StoryboardEditPanelProps {
  panel: StoryboardPanel | null
  onUpdate: (panel: StoryboardPanel) => void
  onClose: () => void
}

export const StoryboardEditPanel = memo(function StoryboardEditPanel({
  panel,
  onUpdate,
  onClose,
}: StoryboardEditPanelProps) {
  const [prompt, setPrompt] = useState(panel?.prompt || "")
  const [duration, setDuration] = useState(panel?.duration || 5)

  const handleSave = useCallback(() => {
    if (panel) {
      onUpdate({
        ...panel,
        prompt,
        duration: duration as any,
      })
      onClose()
    }
  }, [panel, prompt, duration, onUpdate, onClose])

  if (!panel) return null

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-white">Edit Storyboard Step</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-[var(--hover-overlay)] rounded-lg text-neutral-500 hover:text-white transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* Preview */}
        {panel.imageUrl && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-400 uppercase">Preview</label>
            <div className="relative w-full aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-[var(--border-default)]">
              <img
                src={panel.imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white">
                {panel.type === "transition" ? "🔄 Transition" : "📸 Scene"}
              </div>
            </div>
          </div>
        )}

        {/* Prompt */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400 uppercase">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-24 p-3 rounded-lg bg-neutral-900 border border-[var(--border-default)] text-white text-sm resize-none focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            placeholder="Enter prompt..."
          />
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400 uppercase">Duration (seconds)</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full p-2 rounded-lg bg-neutral-900 border border-[var(--border-default)] text-white text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          >
            <option value={2}>2s</option>
            <option value={3}>3s</option>
            <option value={4}>4s</option>
            <option value={5}>5s</option>
            <option value={6}>6s</option>
            <option value={8}>8s</option>
          </select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400 uppercase">Status</label>
          <div className="p-3 rounded-lg bg-neutral-900 border border-[var(--border-default)]">
            <span className="text-xs text-neutral-400 capitalize">{panel.status}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-default)] flex gap-2 shrink-0">
        <button
          onClick={onClose}
          className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border-default)] text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Save
        </button>
      </div>
    </div>
  )
})
