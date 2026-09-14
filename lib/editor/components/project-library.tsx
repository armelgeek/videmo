"use client"

import type React from "react"
import { useRef, useState, memo, useCallback } from "react"
import type { MediaItem } from "../types"
import { PanelLeftClose, TrashIcon } from "./icons"
import { MediaThumbnail } from "./media-thumbnail"
import { StoryboardEditPanel } from "./storyboard-edit-panel"

interface ProjectLibraryProps {
  media: MediaItem[]
  onSelect: (item: MediaItem) => void
  selectedId: string | null
  onAddToTimeline: (item: MediaItem) => void
  onImport: (file: File) => void
  onRemove: (item: MediaItem) => void
  onClose: () => void
  storyboardPanels?: any[]
  onStoryboardPanelClick?: (panel: any, index: number) => void
}

interface LibraryItemProps {
  item: MediaItem
  isSelected: boolean
  onSelect: () => void
  onAddToTimeline: (e: React.MouseEvent) => void
  onRemove: (e: React.MouseEvent) => void
  thumbnailSize: number
}

const LibraryItem = memo(function LibraryItem({
  item,
  isSelected,
  onSelect,
  onAddToTimeline,
  onRemove,
  thumbnailSize,
}: LibraryItemProps) {
  const height = Math.round(thumbnailSize * (9 / 16))

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRemove(e)
    },
    [onRemove],
  )

  const handleAddToTimeline = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onAddToTimeline(e)
    },
    [onAddToTimeline],
  )

  return (
    <div
      className={`flex gap-3 p-2 rounded-lg group transition-all border relative cursor-pointer select-none ${
        isSelected
          ? "bg-[var(--surface-2)] border-border ring-1 ring-inset ring-neutral-700"
          : "bg-transparent border-transparent hover:bg-[var(--surface-2)] hover:border-[var(--border-default)]"
      }`}
      onClick={onSelect}
    >
      <MediaThumbnail
        item={item}
        width={thumbnailSize}
        height={height}
        playOnHover
        lazy
        className="shrink-0 shadow-sm"
      />

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <p
          className={`text-[11px] font-medium leading-tight truncate ${
            isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {item.prompt || (item.type === "audio" ? "Audio Track" : "Untitled Media")}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-muted-foreground">{item.duration.toFixed(1)}s</span>
            <span className="text-[9px] text-muted-foreground border border-[var(--border-default)] px-1 rounded bg-background uppercase">
              {item.type}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1.5 hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-400 transition-all transform hover:scale-110"
              title="Remove from Library"
              onClick={handleRemove}
            >
              <TrashIcon className="w-3 h-3" />
            </button>
            <button
              className="p-1.5 bg-muted hover:bg-[var(--accent-primary)] hover:text-accent-text-foreground rounded text-muted-foreground transition-all transform hover:scale-110"
              title="Add to Timeline"
              onClick={handleAddToTimeline}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export const ProjectLibrary = memo(function ProjectLibrary({
  media,
  onSelect,
  selectedId,
  onAddToTimeline,
  onImport,
  onRemove,
  onClose,
  storyboardPanels = [],
  onStoryboardPanelClick,
}: ProjectLibraryProps) {
  const [thumbnailSize, setThumbnailSize] = useState(80)
  const [filter, setFilter] = useState<"all" | "video" | "image" | "audio">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [editingPanel, setEditingPanel] = useState<any | null>(null)

  const filteredMedia = media.filter((item) => filter === "all" || item.type === filter)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) onImport(file)
    },
    [onImport],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onImport(file)
    },
    [onImport],
  )

  return (
    <div
      className={`flex flex-col h-full relative ${isDragOver ? "ring-2 ring-[var(--accent-primary)] ring-inset" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="p-3 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-foreground">Project Media</span>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-[var(--hover-overlay)] rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-1.5 px-3 py-2.5 border-b border-[var(--border-default)] shrink-0">
        {(["all", "video", "image", "audio"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[11px] rounded-full font-medium transition-all ${
              filter === f ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-[var(--hover-overlay)]"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {filteredMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-3 p-4">
            <p className="text-muted-foreground">No media yet</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-[var(--hover-overlay)] hover:bg-[var(--active-overlay)] rounded-lg text-foreground/80 hover:text-accent-text-foreground transition-colors font-medium"
            >
              Import Media
            </button>
          </div>
        ) : (
          filteredMedia.map((item) => (
            <LibraryItem
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              onSelect={() => onSelect(item)}
              onAddToTimeline={(e) => {
                e.stopPropagation()
                onAddToTimeline(item)
              }}
              onRemove={(e) => {
                e.stopPropagation()
                onRemove(item)
              }}
              thumbnailSize={thumbnailSize}
            />
          ))
        )}
      </div>

      {editingPanel ? (
        <StoryboardEditPanel
          panel={editingPanel}
          onUpdate={(updated) => {
            // Update the panel in storyboardPanels
            const idx = storyboardPanels.findIndex((p) => p.id === updated.id)
            if (idx !== -1) {
              const newPanels = [...storyboardPanels]
              newPanels[idx] = updated
              // Call the update callback if exists
            }
          }}
          onClose={() => setEditingPanel(null)}
        />
      ) : storyboardPanels && storyboardPanels.length > 0 ? (
        <div className="border-t border-[var(--border-default)] p-2">
          <p className="text-[11px] font-medium text-muted-foreground px-2 py-1">
            Generation Storyboard
          </p>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {storyboardPanels.map((panel, idx) => (
              <div
                key={panel.id}
                onClick={() => setEditingPanel(panel)}
                className="group cursor-pointer rounded overflow-hidden border border-[var(--border-default)] hover:border-[var(--accent-primary)] transition-all"
              >
                {panel.imageUrl && (
                  <div className="relative w-full aspect-video bg-background overflow-hidden">
                    <img
                      src={panel.imageUrl}
                      alt={`Step ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="p-2.5 border-t border-[var(--border-default)] flex items-center justify-between shrink-0">
        <input type="file" ref={fileInputRef} accept="video/*,audio/*,image/*" onChange={handleFileChange} hidden />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-[11px] text-muted-foreground hover:text-foreground px-3 py-1.5 bg-[var(--hover-overlay)] hover:bg-[var(--active-overlay)] rounded-lg transition-colors font-medium"
        >
          + Import
        </button>
        <input
          type="range"
          min="60"
          max="120"
          value={thumbnailSize}
          onChange={(e) => setThumbnailSize(Number.parseInt(e.target.value))}
          className="w-20 h-1 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent-primary)] [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      {isDragOver && (
        <div className="absolute inset-0 bg-[var(--accent-primary)]/20 flex items-center justify-center pointer-events-none z-50 backdrop-blur-sm">
          <p className="text-foreground font-medium">Drop to import</p>
        </div>
      )}
    </div>
  )
})
