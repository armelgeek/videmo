"use client";

import { TooltipTrigger } from "@/components/ui/tooltip";

import { memo } from "react";
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
  currentTime: number;
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
  currentTime,
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
    const newTime = Math.max(
      0,
      Math.min(duration, currentTime + frameDuration * direction),
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
                className={`h-6 w-6 hover:bg-[var(--hover-overlay)] ${historyCount > 0 ? "text-[var(--text-primary)] hover:text-white" : "text-[var(--text-muted)] cursor-not-allowed"}`}
                onClick={onUndo}
                disabled={historyCount === 0}
              >
                <UndoIcon className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 hover:bg-[var(--hover-overlay)] ${futureCount > 0 ? "text-[var(--text-primary)] hover:text-white" : "text-[var(--text-muted)] cursor-not-allowed"}`}
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
              className="h-7 w-7 text-white hover:bg-[var(--accent-bg-subtle)] hover:text-[var(--accent-text)]"
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
            <span className="text-[var(--accent-text)] font-bold tabular-nums">
              {formatTimecode(currentTime, frameRate)}
            </span>
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
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.04] border border-white/[0.06] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
            >
              <kbd className="text-[10px] font-mono bg-white/[0.06] px-1 rounded">
                ?
              </kbd>
              <span className="text-[10px] font-medium">Shortcuts</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-[var(--hover-overlay)] rounded-md p-1 border border-[var(--border-default)]">
            <button
              onClick={() => onZoomChange(getPrevZoom(zoomLevel))}
              className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] hover:bg-white/[0.06] rounded"
            >
              <ZoomOutIcon className="w-3.5 h-3.5" />
            </button>
            {onZoomToFit && (
              <button
                onClick={onZoomToFit}
                className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] hover:bg-white/[0.06] rounded"
              >
                <MaximizeIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onZoomChange(getNextZoom(zoomLevel))}
              className="p-1 hover:text-[var(--text-primary)] text-[var(--text-tertiary)] hover:bg-white/[0.06] rounded"
            >
              <ZoomInIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});

const formatTimecode = (seconds: number, frameRate = 30) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * frameRate);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
};
