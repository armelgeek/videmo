"use client";

import { TooltipTrigger } from "@/components/ui/tooltip";

import { memo } from "react";
import { readPlaybackPosition, usePlaybackPosition } from "../playback-clock";
import type { SnapConfig } from "../hooks/use-timeline-snap";
import { getNextZoom, getPrevZoom } from "../utils/timeline-scale";
import {
  MagnetIcon,
  ScissorsIcon,
  SplitIcon,
  ChevronDownIcon,
  CheckIcon,
  ZoomInIcon,
  ZoomOutIcon,
  EyeIcon,
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoopIcon,
  UndoIcon,
  RedoIcon,
  FlagIcon,
  MaximizeIcon,
} from "./icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface TimelineToolbarProps {
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  tool: "select" | "razor";
  zoomLevel: number;
  selectedClipCount: number;
  snapConfig: SnapConfig;
  showSnapMenu: boolean;
  isRendering?: boolean;
  renderProgress?: number;
  renderedPreviewUrl?: string | null;
  isPreviewStale?: boolean;
  isPreviewPlayback?: boolean;
  frameRate?: number;
  historyCount?: number;
  futureCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onShowShortcuts?: () => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onToggleLoop: () => void;
  onToolChange: (tool: "select" | "razor") => void;
  onSplitAtPlayhead: () => void;
  onZoomChange: (zoom: number) => void;
  onToggleSnap: () => void;
  onToggleSnapOption: (key: keyof SnapConfig) => void;
  onSetGridInterval: (interval: number) => void;
  onSetShowSnapMenu: (show: boolean) => void;
  onRenderPreview?: () => void;
  onCancelRender?: () => void;
  onTogglePreviewPlayback?: () => void;
  onAddMarker?: () => void;
  onZoomToFit?: () => void;
}

export const TimelineToolbar = memo(function TimelineToolbar({
  duration,
  isPlaying,
  isLooping,
  tool,
  zoomLevel,
  selectedClipCount,
  snapConfig,
  showSnapMenu,
  isRendering = false,
  renderProgress = 0,
  renderedPreviewUrl = null,
  isPreviewStale = false,
  isPreviewPlayback = false,
  frameRate = 30,
  historyCount = 0,
  futureCount = 0,
  onUndo,
  onRedo,
  onShowShortcuts,
  onPlayPause,
  onSeek,
  onToggleLoop,
  onToolChange,
  onSplitAtPlayhead,
  onZoomChange,
  onToggleSnap,
  onToggleSnapOption,
  onSetGridInterval,
  onSetShowSnapMenu,
  onRenderPreview,
  onCancelRender,
  onTogglePreviewPlayback,
  onAddMarker,
  onZoomToFit,
}: TimelineToolbarProps) {
  const frameDuration = 1 / frameRate;

  const stepFrame = (direction: 1 | -1) => {
    // Position READ at step time: the toolbar does not need to render every
    // frame to know where to step one frame from.
    const newTime = Math.max(
      0,
      Math.min(duration, readPlaybackPosition() + frameDuration * direction),
    );
    onSeek(newTime);
  };

  const jumpToStart = () => onSeek(0);
  const jumpToEnd = () => onSeek(duration);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-11 flex items-center justify-between px-4 bg-[var(--surface-0)] shrink-0 z-30 overflow-x-auto min-w-0 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex items-center gap-3 shrink-0">
          {onUndo && onRedo && (
            <>
              <div className="flex items-center gap-0.5 bg-[var(--hover-overlay)] rounded-md p-0.5 border border-[var(--border-default)]">
                <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 hover:bg-[var(--hover-overlay)] ${historyCount > 0 ? "text-[var(--text-primary)] hover:text-foreground" : "text-[var(--text-muted)] cursor-not-allowed"}`}
                onClick={onUndo}
                disabled={historyCount === 0}
              >
                <UndoIcon className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 hover:bg-[var(--hover-overlay)] ${futureCount > 0 ? "text-[var(--text-primary)] hover:text-foreground" : "text-[var(--text-muted)] cursor-not-allowed"}`}
                onClick={onRedo}
                disabled={futureCount === 0}
              >
                <RedoIcon className="h-3.5 w-3.5" />
              </Button>
              </div>

              <div className="h-4 w-px bg-[var(--border-default)]" />
            </>
          )}

          <div className="flex items-center gap-0.5 bg-[var(--hover-overlay)] rounded-md p-0.5 border border-[var(--border-default)]">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground hover:bg-[var(--accent-bg-subtle)] hover:text-[var(--accent-text)]"
              onClick={onPlayPause}
            >
              {isPlaying ? (
                <PauseIcon className="h-3.5 w-3.5" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Timecode Display */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <CurrentTimecode frameRate={frameRate} />
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--text-secondary)] tabular-nums">
              {formatTimecode(duration, frameRate)}
            </span>
          </div>




          {/* Selection Count Badge */}
          {selectedClipCount > 1 && (
            <div className="px-2 py-0.5 bg-[var(--accent-bg-subtle)] text-[var(--accent-text)] rounded text-[10px] font-medium border border-[var(--accent-border)]">
              {selectedClipCount} Clips Selected
            </div>
          )}
        </div>

        {/* Right side - Zoom Controls and Shortcuts */}
        <div className="flex items-center gap-3 shrink-0">

          {onShowShortcuts && (
            <button
              onClick={onShowShortcuts}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--hover-overlay)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-accent transition-colors"
            >
              <kbd className="text-[10px] font-mono bg-card px-1 rounded">
                ?
              </kbd>
              <span className="text-[10px] font-medium">Shortcuts</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-[var(--hover-overlay)] rounded-md p-1 border border-[var(--border-default)]">
            <button
              onClick={() => onZoomChange(getPrevZoom(zoomLevel))}
              className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] hover:bg-accent rounded"
            >
              <ZoomOutIcon className="w-3.5 h-3.5" />
            </button>
            {onZoomToFit && (
              <button
                onClick={onZoomToFit}
                className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] hover:bg-accent rounded"
              >
                <MaximizeIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onZoomChange(getNextZoom(zoomLevel))}
              className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] hover:bg-accent rounded"
            >
              <ZoomInIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});

/**
 * The time counter, the only toolbar element that follows the clock.
 *
 * Isolated so the bar — its twenty buttons, its menus — does not render every
 * frame just to display changing digits.
 */
const CurrentTimecode = memo(function CurrentTimecode({
  frameRate,
}: {
  frameRate: number;
}) {
  const position = usePlaybackPosition();
  return (
    <span className="text-[var(--accent-text)] font-bold tabular-nums">
      {formatTimecode(position, frameRate)}
    </span>
  );
});

// mm:ss.cc — "01:47:18" read as hours, and frames meant nothing to users.
const formatTimecode = (seconds: number, _frameRate = 30) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.floor((safe % 1) * 100);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
};
