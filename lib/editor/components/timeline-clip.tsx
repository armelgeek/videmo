"use client"

import type React from "react"
import { memo } from "react"
import type { TimelineClip, MediaItem, Track } from "../types"
import { ClipWaveform } from "./clip-waveform"
import {
  LockIcon,
  FilmIcon,
  MusicIcon,
  TypeIcon,
  ImageIcon,
  Sparkles,
  VolumeIcon,
  MuteIcon,
  TransitionIcon,
} from "./icons"

interface TimelineClipItemProps {
  clip: TimelineClip
  media: MediaItem | undefined
  track: Track
  zoomLevel: number
  isSelected: boolean
  tool: "select" | "razor"
  onMouseDown: (e: React.MouseEvent, mode: "move" | "trim-start" | "trim-end") => void
  onContextMenu: (e: React.MouseEvent) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  tabIndex?: number
  clipIndex?: number
}

export const TimelineClipItem = memo(
  ({
    clip,
    media,
    track,
    zoomLevel,
    isSelected,
    tool,
    onMouseDown,
    onContextMenu,
    onKeyDown,
    tabIndex = 0,
    clipIndex,
  }: TimelineClipItemProps) => {
    const isAudio = track.type === "audio"
    const isText = track.type === "text"
    const isImage = media?.type === "image"
    const isLocked = Boolean(clip.isLocked || track.isLocked)

    const clipWidth = clip.duration * zoomLevel
    const isTiny = clipWidth < 48
    const isCompact = clipWidth < 90

    const handleClipMouseDown = (e: React.MouseEvent, mode: "move" | "trim-start" | "trim-end") => {
      if (!isLocked) {
        onMouseDown(e, mode)
      }
    }

    // Index badge (#1, #2...) derived from the ID (e.g. p0-a) or the rank
    const pMatch = clip.id.match(/^p(\d+)-(.+)$/)
    const indexBadge = pMatch
      ? `#${Number(pMatch[1]) + 1}`
      : typeof clipIndex === "number"
        ? `#${clipIndex + 1}`
        : null

    // Clean clip title
    const rawTitle = isText
      ? clip.textOverlay?.text || "Texte"
      : media?.prompt || (isAudio ? "Piste audio" : isImage ? "Image" : "Clip vidéo")
    const clipTitle = rawTitle.replace(/^p\d+-/, "").trim() || "Clip"

    // Neo-brutalist Sketch theme: plain card background, hard border and offset shadow
    const borderAndShadow = isSelected
      ? "border-2 border-highlight ring-2 ring-highlight/50 shadow-[3px_3px_0_hsl(var(--offset))]"
      : "border-2 border-ink/80 hover:border-highlight shadow-[2px_2px_0_hsl(var(--offset))] hover:shadow-[3px_3px_0_hsl(var(--offset))]"

    const bgSurface = isSelected
      ? "bg-card/95"
      : "bg-card/85 hover:bg-card"

    const cursorClass = isLocked
      ? "cursor-not-allowed"
      : tool === "razor"
        ? "cursor-crosshair"
        : "cursor-pointer"

    const verticalPos = isText || isAudio ? "top-1 bottom-1" : "top-0.5 bottom-0.5"

    const formatTimeForSR = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins} minutes ${secs} seconds`
    }

    const clipLabel = `${isText ? "Texte" : isAudio ? "Audio" : isImage ? "Image" : "Vidéo"} ${indexBadge || ""} : ${clipTitle}. Durée : ${formatTimeForSR(clip.duration)}.`

    // Active effects
    const hasEffects =
      clip.effects &&
      Object.entries(clip.effects).some(([key, val]) => {
        if (key === "opacity") return val !== 100
        return val !== 0
      })

    const hasCustomVolume = clip.volume !== undefined && clip.volume !== 1
    const isMuted = track.isMuted || clip.volume === 0

    return (
      <div
        role="button"
        aria-label={clipLabel}
        aria-selected={isSelected}
        aria-disabled={isLocked}
        tabIndex={isLocked ? -1 : tabIndex}
        onKeyDown={onKeyDown}
        data-clip="true"
        className={`clip-item absolute ${verticalPos} rounded-lg overflow-visible ${cursorClass} flex items-center transition-all duration-75 select-none group/item ${borderAndShadow} ${bgSurface} focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight`}
        style={{
          left: `${clip.start * zoomLevel}px`,
          width: `${Math.max(16, clipWidth)}px`,
          opacity: track.isMuted ? 0.6 : undefined,
        }}
        onMouseDown={(e) => handleClipMouseDown(e, "move")}
        onContextMenu={onContextMenu}
      >
        {/* Accent strip if a specific stroke colour exists */}
        {clip.color && (
          <div
            className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full pointer-events-none"
            style={{ backgroundColor: clip.color }}
          />
        )}

        {/* Hatched pattern when locked */}
        {isLocked && (
          <div
            className="absolute inset-0 z-40 rounded-lg pointer-events-none opacity-25"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0, 0, 0, 0.4) 6px, rgba(0, 0, 0, 0.4) 12px)",
            }}
          />
        )}

        {/* Padlock when locked */}
        {isLocked && (
          <div
            className="absolute top-1 right-1 z-50 bg-card/90 rounded p-0.5 shadow-sm border border-border"
            title="Clip verrouillé"
          >
            <LockIcon className="w-2.5 h-2.5 text-highlight" />
          </div>
        )}

        {/* Fade in */}
        {clip.fadeIn && clip.fadeIn > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 z-20 pointer-events-none overflow-hidden rounded-l-lg"
            style={{ width: `${Math.min(clipWidth, clip.fadeIn * zoomLevel)}px` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-transparent" />
            <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
              <polygon points="0,100% 100%,0 100%,100%" fill="hsl(var(--highlight))" />
            </svg>
          </div>
        )}

        {/* Fade out */}
        {clip.fadeOut && clip.fadeOut > 0 && (
          <div
            className="absolute right-0 top-0 bottom-0 z-20 pointer-events-none overflow-hidden rounded-r-lg"
            style={{ width: `${Math.min(clipWidth, clip.fadeOut * zoomLevel)}px` }}
          >
            <div className="absolute inset-0 bg-gradient-to-l from-background/90 to-transparent" />
            <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
              <polygon points="0,0 100%,100% 0,100%" fill="hsl(var(--highlight))" />
            </svg>
          </div>
        )}

        {/* Transition */}
        {clip.transition && clip.transition.type !== "none" && (
          <div
            className="absolute left-0 top-0 bottom-0 z-30 bg-gradient-to-r from-highlight/25 to-transparent pointer-events-none border-r border-highlight/60 flex items-center justify-start pl-1 rounded-l-lg"
            style={{ width: `${Math.min(clipWidth, clip.transition.duration * zoomLevel)}px` }}
            aria-hidden="true"
          >
            <TransitionIcon className="w-2.5 h-2.5 shrink-0 text-highlight" />
          </div>
        )}

        {/* Trim handles */}
        {!isLocked && (
          <>
            <div
              role="slider"
              aria-label="Trim start"
              aria-valuemin={0}
              aria-valuemax={clip.start + clip.duration}
              aria-valuenow={clip.start}
              className={`absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize z-40 flex items-center justify-center group/handle transition-opacity ${
                isSelected ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
              }`}
              onMouseDown={(e) => handleClipMouseDown(e, "trim-start")}
            >
              <div className="w-1.5 h-6 bg-highlight border border-ink rounded-sm shadow-[1px_1px_0_hsl(var(--offset))] group-hover/handle:scale-125 group-hover/handle:bg-white transition-all flex flex-col justify-center items-center gap-[2px]">
                <div className="w-[2px] h-[2px] bg-ink rounded-full" />
                <div className="w-[2px] h-[2px] bg-ink rounded-full" />
                <div className="w-[2px] h-[2px] bg-ink rounded-full" />
              </div>
            </div>

            <div
              role="slider"
              aria-label="Trim end"
              aria-valuemin={clip.start}
              aria-valuemax={clip.start + clip.duration + 10}
              aria-valuenow={clip.start + clip.duration}
              className={`absolute -right-2 top-0 bottom-0 w-4 cursor-ew-resize z-40 flex items-center justify-center group/handle transition-opacity ${
                isSelected ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
              }`}
              onMouseDown={(e) => handleClipMouseDown(e, "trim-end")}
            >
              <div className="w-1.5 h-6 bg-highlight border border-ink rounded-sm shadow-[1px_1px_0_hsl(var(--offset))] group-hover/handle:scale-125 group-hover/handle:bg-white transition-all flex flex-col justify-center items-center gap-[2px]">
                <div className="w-[2px] h-[2px] bg-ink rounded-full" />
                <div className="w-[2px] h-[2px] bg-ink rounded-full" />
                <div className="w-[2px] h-[2px] bg-ink rounded-full" />
              </div>
            </div>
          </>
        )}

        {/* Audio waveform in the bottom background */}
        {!isText && !clip.isAudioDetached && media?.url && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 opacity-35 px-1 pointer-events-none">
            <ClipWaveform
              mediaUrl={media.url}
              duration={clip.duration}
              offset={clip.offset}
              isAudio={isAudio}
              isSelected={isSelected}
              zoomLevel={zoomLevel}
            />
          </div>
        )}

        {/* Main content: full 44px height, centred, with badge and crisp typography */}
        <div className="relative z-10 w-full h-full flex items-center justify-between px-2 gap-2 overflow-hidden">
          {/* Left side: #1 badge + icon + title in text-xs font-bold */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {indexBadge && !isTiny && (
              <span className="shrink-0 flex items-center justify-center h-4.5 px-1.5 rounded border border-ink bg-highlight text-highlight-foreground font-mono text-[9px] font-black shadow-[1px_1px_0_hsl(var(--offset))]">
                {indexBadge}
              </span>
            )}

            <span className="shrink-0 text-highlight">
              {isText ? (
                <TypeIcon className="w-3.5 h-3.5" />
              ) : isAudio ? (
                <MusicIcon className="w-3.5 h-3.5" />
              ) : isImage ? (
                <ImageIcon className="w-3.5 h-3.5" />
              ) : (
                <FilmIcon className="w-3.5 h-3.5" />
              )}
            </span>

            {!isTiny && (
              <span className="text-xs font-bold truncate tracking-tight text-foreground group-hover/item:text-highlight transition-colors">
                {clipTitle}
              </span>
            )}
          </div>

          {/* Right side: badges and duration */}
          {!isTiny && (
            <div className="flex items-center gap-1 shrink-0">
              {clip.speed && clip.speed !== 1 && !isCompact && (
                <span className="px-1 py-0.5 rounded text-[9px] font-bold text-highlight border border-highlight/40">
                  {clip.speed}x
                </span>
              )}

              {hasEffects && !isCompact && (
                <span className="text-highlight">
                  <Sparkles className="w-3 h-3" />
                </span>
              )}

              {(hasCustomVolume || isMuted) && !isCompact && (
                <span className="text-destructive">
                  {isMuted ? <MuteIcon className="w-3 h-3" /> : <VolumeIcon className="w-3 h-3" />}
                </span>
              )}

              <span className="text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded bg-background/80 text-foreground border border-ink/40 shadow-2xs">
                {clip.duration.toFixed(1)}s
              </span>
            </div>
          )}
        </div>
      </div>
    )
  },
)

TimelineClipItem.displayName = "TimelineClipItem"
