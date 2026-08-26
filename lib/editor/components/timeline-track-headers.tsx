"use client";

import type React from "react";

import { memo, useCallback, useState } from "react";
import type { Track } from "../types";
import {
  GripVerticalIcon,
  LockIcon,
  MuteIcon,
  MusicIcon,
  PlusIcon,
  TypeIcon,
  UnlockIcon,
  VideoIcon,
  VolumeIcon,
} from "./icons";

interface TimelineTrackHeadersProps {
  tracks: Track[];
  hasClips: boolean;
  onTrackUpdate: (trackId: string, changes: Partial<Track>) => void;
  onAddTrack?: (type: "video" | "audio" | "text") => void;
  onReorderTracks?: (trackIds: string[]) => void;
}

const TRACK_CONFIG = {
  video: { height: "h-11", icon: VideoIcon, iconColor: "text-sky-500" },
  audio: { height: "h-16", icon: MusicIcon, iconColor: "text-emerald-500" },
  text: { height: "h-12", icon: TypeIcon, iconColor: "text-purple-500" },
} as const;

const ADD_TRACK_TYPES = ["video", "audio", "text"] as const;

export const TimelineTrackHeaders = memo(function TimelineTrackHeaders({
  tracks,
  hasClips,
  onTrackUpdate,
  onAddTrack,
  onReorderTracks,
}: TimelineTrackHeadersProps) {
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, trackId: string) => {
    setDraggedTrackId(trackId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", trackId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (trackId !== draggedTrackId) setDragOverTrackId(trackId);
    },
    [draggedTrackId],
  );

  const handleDragLeave = useCallback(() => setDragOverTrackId(null), []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetTrackId: string) => {
      e.preventDefault();
      if (
        draggedTrackId &&
        draggedTrackId !== targetTrackId &&
        onReorderTracks
      ) {
        const order = tracks.map((t) => t.id);
        const from = order.indexOf(draggedTrackId);
        const to = order.indexOf(targetTrackId);
        if (from !== -1 && to !== -1) {
          order.splice(from, 1);
          order.splice(to, 0, draggedTrackId);
          onReorderTracks(order);
        }
      }
      setDraggedTrackId(null);
      setDragOverTrackId(null);
    },
    [draggedTrackId, tracks, onReorderTracks],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  }, []);

  if (!hasClips) {
    if (!onAddTrack)
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-3" />
      );
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3">
        <div className="flex flex-col gap-1 w-full">
          {ADD_TRACK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => onAddTrack(type)}
              className="flex items-center justify-center gap-2 w-full py-1.5 rounded border border-[var(--border-default)] hover:bg-[var(--surface-3)] text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors capitalize"
            >
              <PlusIcon className="w-3 h-3" /> {type}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {tracks.map((track) => {
        const { height, icon: Icon, iconColor } = TRACK_CONFIG[track.type];
        const isDragging = draggedTrackId === track.id;
        const isDragOver = dragOverTrackId === track.id;

        return (
          <div
            key={track.id}
            draggable
            onDragStart={(e) => handleDragStart(e, track.id)}
            onDragOver={(e) => handleDragOver(e, track.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, track.id)}
            onDragEnd={handleDragEnd}
            className={`${height} border-b border-[var(--border-subtle)] flex flex-col px-3 py-2 gap-1 bg-[var(--surface-0)] relative group/header shrink-0 transition-all
              ${isDragging ? "opacity-50" : ""}
              ${isDragOver ? "border-t-2 border-t-[var(--accent-primary)]" : ""}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {/**<div className="cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text-secondary)] opacity-0 group-hover/header:opacity-100 transition-opacity">
                  <GripVerticalIcon className="w-3 h-3" />
                </div>**/}
                <span
                  className="text-sm text-[var(--text-primary)] font-bold uppercase tracking-wider truncate"
                  title={track.name}
                >
                  {track.name}
                </span>
              </div>
              {/**<div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
                <button
                  onClick={() =>
                    onTrackUpdate(track.id, { isLocked: !track.isLocked })
                  }
                  className={`p-1 rounded hover:bg-[var(--surface-3)] ${track.isLocked ? "text-amber-500" : "text-[var(--text-muted)]"}`}
                >
                  {track.isLocked ? (
                    <LockIcon className="w-3 h-3" />
                  ) : (
                    <UnlockIcon className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() =>
                    onTrackUpdate(track.id, { isMuted: !track.isMuted })
                  }
                  className={`p-1 rounded hover:bg-[var(--surface-3)] ${track.isMuted ? "text-red-400" : "text-[var(--text-muted)]"}`}
                >
                  <MuteIcon className="w-3 h-3" />
                </button>
              </div>**/}
            </div>

            {/**<div className="flex-1 bg-[var(--surface-1)] rounded border border-[var(--border-subtle)] flex flex-col items-center justify-center overflow-hidden relative">
              <TrackVisual track={track} onTrackUpdate={onTrackUpdate} />
              {track.isLocked && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                  <LockIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
                </div>
              )}
            </div>**/}
          </div>
        );
      })}

      {/* Spacer */}
      <div className="h-20 shrink-0" />
    </>
  );
});

function TrackVisual({
  track,
  onTrackUpdate,
}: {
  track: Track;
  onTrackUpdate: (trackId: string, changes: Partial<Track>) => void;
}) {
  if (track.type === "audio") {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center px-2 gap-1 transition-opacity ${
          track.isMuted ? "opacity-30" : "opacity-100"
        }`}
      >
        <div className="flex items-center gap-2 w-full">
          <VolumeIcon className="w-3 h-3 text-[var(--text-tertiary)]" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume ?? 1}
            disabled={track.isLocked}
            onChange={(e) =>
              onTrackUpdate(track.id, {
                volume: Number.parseFloat(e.target.value),
              })
            }
            className="w-full h-1 bg-[var(--surface-3)] rounded-lg appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>
    );
  }

  if (track.type === "text") {
    return (
      <div
        className={`text-[10px] text-purple-400/60 ${track.isMuted ? "opacity-30" : ""}`}
      >
        Text Layer
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-0.5 h-3 ${track.isMuted ? "opacity-10" : "opacity-20"}`}
    >
      {WAVEFORM_BARS.map((h, i) => (
        <div
          key={i}
          className="w-1 bg-[var(--text-secondary)]"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

// Static so the "waveform" doesn't reshuffle on every render.
const WAVEFORM_BARS = Array.from({ length: 10 }, () => Math.random() * 100);
