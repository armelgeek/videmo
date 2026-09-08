"use client";

import type React from "react";
import { useRef, useState, useCallback, memo, useMemo, useEffect } from "react";
import type { TimelineClip, Track, MediaItem, Marker } from "../types";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineClipItem } from "./timeline-clip";
import { TimelineToolbar } from "./timeline-toolbar";
import { PlayheadCursor } from "./playhead-cursor";
import {
  abonnerPositionLecture,
  lirePositionLecture,
} from "../playback-clock";
import { TimelineTrackHeaders } from "./timeline-track-headers";
import { TimelineContextMenu } from "./timeline-context-menu";
import { TimelineMarkers } from "./timeline-markers";
import { useTimelineSnap } from "../hooks/use-timeline-snap";
import { useTimelineDrag } from "../hooks/use-timeline-drag";
import { useTimelineSelection } from "../hooks/use-timeline-selection";
import { useScrollPosition } from "../hooks/use-virtualized-clips";
import { FilmIcon } from "./icons";
import {
  markerGeometry,
  type TransitionMarker,
} from "@/lib/whiteboard-animation/timeline/transition-marker-geometry";
import type { ClipWindow } from "@/lib/whiteboard-animation/timeline/clip-transitions";

interface TimelineProps {
  tracks: Track[];
  clips: TimelineClip[];
  mediaMap: Record<string, MediaItem>;
  duration: number;
  zoomLevel: number;
  selectedClipIds: string[];
  className?: string;
  style?: React.CSSProperties;
  tool: "select" | "razor";
  isPlaying: boolean;
  isLooping: boolean;
  onPlayPause: () => void;
  onToggleLoop: () => void;
  onSeek: (time: number) => void;
  onSelectClips: (clipIds: string[]) => void;
  onZoomChange: (zoom: number) => void;
  onClipUpdate: (clipId: string, changes: Partial<TimelineClip>) => void;
  onTrackUpdate: (trackId: string, changes: Partial<Track>) => void;
  onSplitClip: (clipId: string, splitTime: number) => void;
  onDetachAudio: (clipId: string) => void;
  onDeleteClip: (clipIds: string[]) => void;
  onRippleDeleteClip: (clipIds: string[]) => void;
  onDuplicateClip: (clipIds: string[]) => void;
  onToolChange: (tool: "select" | "razor") => void;
  onDragStart: () => void;
  onAddTrack?: (type: "video" | "audio" | "text") => void;
  onReorderTracks?: (trackIds: string[]) => void;
  onAddTextClip?: (trackId: string, start: number) => void;
  isRendering?: boolean;
  renderProgress?: number;
  renderedPreviewUrl?: string | null;
  isPreviewStale?: boolean;
  onRenderPreview?: () => void;
  onCancelRender?: () => void;
  isPreviewPlayback?: boolean;
  onTogglePreviewPlayback?: () => void;
  onExportAudio?: (clipIds: string[]) => void;
  frameRate?: number;
  historyCount?: number;
  futureCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onShowShortcuts?: () => void;
  markers?: Marker[];
  onAddMarker?: () => void;
  onMarkerClick?: (marker: Marker) => void;
  onMarkerDelete?: (markerId: string) => void;
  onMarkerUpdate?: (markerId: string, changes: Partial<Marker>) => void;
  onZoomToFit?: () => void;
  onOverwriteClips?: (movedClipIds: string[]) => void;
  storyboardPanels?: any[];
  onStoryboardPanelClick?: (panel: any, index: number) => void;
  clipWindows?: ClipWindow[];
  onTransitionResize?: (panelIdx: number, durationMs: number) => void;
  onTransitionTypeChange?: (panelIdx: number, type: string) => void;
  /**
   * Empty space kept past the end of the content, in px. Defaults to a full
   * viewport so the video editor can scroll beyond the last clip; pass a small
   * value when the ruler should stop close to the content.
   */
  endPadding?: number;
  /**
   * Hide the scroll bars while keeping the area scrollable. The annotation
   * timeline is only a few rows tall, where a permanent bar eats a visible
   * slice of the lane for little benefit.
   */
  hideScrollbar?: boolean;
  /**
   * Draw this component's own playhead. False when the host renders a single
   * cursor spanning several lanes, which would otherwise sit on top of it.
   */
  showPlayhead?: boolean;
  /**
   * Reports the horizontal viewport so a lane rendered OUTSIDE this component
   * can line up with the ruler: same pixels-per-second, same scroll offset.
   * Without it such a lane keeps its own scale and drifts away from the
   * playhead as soon as the timeline is scrolled or zoomed.
   *
   * The scroll ELEMENT is handed over rather than its offset: auto-scroll
   * during playback moves it ~22 times a second, and pushing that through
   * React state re-rendered the whole subtree at the same rate. Consumers
   * listen on the element and update themselves imperatively.
   */
  onViewportChange?: (viewport: {
    scrollEl: HTMLElement | null;
    contentWidth: number;
    zoomLevel: number;
  }) => void;
}

export const Timeline = memo(function Timeline({
  tracks,
  clips,
  mediaMap,
  duration,
  zoomLevel,
  selectedClipIds = [],
  className,
  style,
  tool,
  isPlaying,
  isLooping,
  onPlayPause,
  onToggleLoop,
  onSeek,
  onSelectClips,
  onZoomChange,
  onClipUpdate,
  onTrackUpdate,
  onSplitClip,
  onDetachAudio,
  onDeleteClip,
  onRippleDeleteClip,
  onDuplicateClip,
  onToolChange,
  onDragStart,
  onAddTrack,
  onReorderTracks,
  onAddTextClip,
  isRendering = false,
  renderProgress = 0,
  renderedPreviewUrl = null,
  isPreviewStale = false,
  onRenderPreview,
  onCancelRender,
  isPreviewPlayback = false,
  onTogglePreviewPlayback,
  onExportAudio,
  frameRate = 30,
  historyCount = 0,
  futureCount = 0,
  onUndo,
  onRedo,
  onShowShortcuts,
  markers = [],
  onAddMarker,
  onMarkerClick,
  onMarkerDelete,
  onMarkerUpdate,
  onZoomToFit,
  onOverwriteClips,
  endPadding,
  onViewportChange,
  clipWindows,
  onTransitionResize,
  onTransitionTypeChange,
  showPlayhead = true,
  hideScrollbar = false,
}: TimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
  } | null>(null);

  const { scrollLeft, viewportWidth } = useScrollPosition(scrollContainerRef);

  const visibleTracks = useMemo(() => {
    return tracks;
  }, [tracks]);

  const visibleClipsByTrack = useMemo(() => {
    const buffer = 200;
    const startTime = Math.max(0, (scrollLeft - buffer) / zoomLevel);
    const endTime = (scrollLeft + viewportWidth + buffer) / zoomLevel;

    const result: Record<string, TimelineClip[]> = {};
    for (const track of visibleTracks) {
      result[track.id] = clips.filter((clip) => {
        if (clip.trackId !== track.id) return false;
        const clipEnd = clip.start + clip.duration;
        return clipEnd >= startTime && clip.start <= endTime;
      });
    }
    return result;
  }, [clips, visibleTracks, scrollLeft, viewportWidth, zoomLevel]);

  const totalWidth = useMemo(() => {
    const maxClipEnd =
      clips.length > 0
        ? Math.max(...clips.map((c) => c.start + c.duration))
        : 0;
    // La position de lecture n'entre PLUS dans ce calcul : elle changeait a la
    // frame et refaisait la mesure autant de fois. Le remplissage de fin — un
    // viewport entier par defaut — laisse deja de quoi mener le curseur au-dela
    // du dernier clip.
    const maxTime = Math.max(maxClipEnd, duration || 0);
    const padding = endPadding ?? Math.max(viewportWidth, 300);
    const calculatedWidth = maxTime * zoomLevel + padding;
    return Math.max(calculatedWidth, viewportWidth || 800);
  }, [clips, duration, zoomLevel, viewportWidth, endPadding]);

  // Publish the viewport for lanes rendered outside this component. Scroll
  // offset is deliberately NOT a dependency — see onViewportChange's contract.
  useEffect(() => {
    onViewportChange?.({
      scrollEl: scrollContainerRef.current,
      contentWidth: totalWidth,
      zoomLevel,
    });
  }, [onViewportChange, totalWidth, zoomLevel]);

  const {
    snapConfig,
    showSnapMenu,
    setShowSnapMenu,
    getSnapTime,
    toggleSnapEnabled,
    toggleSnapOption,
    setGridInterval,
  } = useTimelineSnap({
    clips,
    zoomLevel,
    isDraggingPlayhead,
  });

  const {
    dragState,
    snapIndicator,
    handleMouseDownClip,
    handleDragMove,
    handleDragEnd,
  } = useTimelineDrag({
    clips,
    tracks,
    selectedClipIds,
    zoomLevel,
    tool,
    snapEnabled: snapConfig.enabled,
    getSnapTime,
    onClipUpdate,
    onSelectClips,
    onSplitClip,
    onDragStart,
    onOverwriteClips: onOverwriteClips || (() => {}),
    // Borne le trim de fin a la duree reelle du media source. Les clips de texte
    // (mediaId vide) n'ont pas de source : ils restent libres.
    getClipMaxDuration: (clip) => mediaMap[clip.mediaId]?.duration,
  });

  const {
    isSelecting,
    selectionBox,
    handleMouseDownBackground,
    handleSelectionMove,
    handleSelectionEnd,
  } = useTimelineSelection({
    clips,
    tracks,
    zoomLevel,
    tool,
    onSelectClips,
    onToolChange,
    scrollContainerRef,
  });

  const handleTrackDoubleClick = useCallback(
    (e: React.MouseEvent, track: Track) => {
      if (track.type !== "text" || !onAddTextClip) return;
      if (!scrollContainerRef.current) return;

      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const time = Math.max(0, x / zoomLevel);

      onAddTextClip(track.id, time);
    },
    [zoomLevel, onAddTextClip],
  );

  useEffect(() => {
    if (dragState.mode !== "none") {
      const handleMouseMove = (e: MouseEvent) => {
        handleDragMove(e);
      };
      const handleMouseUp = () => {
        handleDragEnd();
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState.mode, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isDraggingPlayhead) {
      const handleMouseMove = (e: MouseEvent) => {
        if (!scrollContainerRef.current) return;
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft;
        const newTime = Math.max(0, Math.min(duration, x / zoomLevel));
        onSeek(newTime);
      };
      const handleMouseUp = () => {
        setIsDraggingPlayhead(false);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDraggingPlayhead, duration, zoomLevel, onSeek]);

  // Auto-scroll timeline to center playhead during playback or dragging.
  //
  // Abonne a l'horloge plutot que dependant d'une prop : le defilement est un
  // geste imperatif sur un element, il n'a jamais eu besoin d'un rendu. Cet
  // effet ne se refait donc qu'au changement de zoom ou de largeur, pas vingt
  // fois par seconde.
  useEffect(() => {
    const suivre = () => {
      const conteneur = scrollContainerRef.current;
      if (!conteneur) return;
      const playheadX = lirePositionLecture() * zoomLevel;
      const currentScrollLeft = conteneur.scrollLeft;
      const viewWidth = viewportWidth || conteneur.clientWidth || 800;
      const halfWidth = viewWidth / 2;

      if (
        playheadX >= currentScrollLeft + halfWidth ||
        playheadX < currentScrollLeft
      ) {
        conteneur.scrollLeft = Math.max(0, playheadX - halfWidth);
      }
    };
    suivre();
    return abonnerPositionLecture(suivre);
  }, [zoomLevel, viewportWidth]);

  useEffect(() => {
    if (isSelecting) {
      const handleMouseMove = (e: MouseEvent) => {
        handleSelectionMove(e);
      };
      const handleMouseUp = () => {
        handleSelectionEnd();
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isSelecting, handleSelectionMove, handleSelectionEnd]);

  useEffect(() => {
    if (contextMenu) {
      const handleClickOutside = (e: MouseEvent) => {
        setContextMenu(null);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setContextMenu(null);
        }
      };

      // Use setTimeout to avoid the menu closing immediately from the same click
      const timer = setTimeout(() => {
        window.addEventListener("click", handleClickOutside);
        window.addEventListener("contextmenu", handleClickOutside);
      }, 0);
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("click", handleClickOutside);
        window.removeEventListener("contextmenu", handleClickOutside);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [contextMenu]);

  const hasNoClips = clips.length === 0;

  return (
    <div
      className={`${className || ""} bg-[var(--surface-0)] flex flex-col h-full w-full flex-1 select-none relative z-10 transition-none overflow-hidden`}
      style={style || { height: "100%" }}
      role="region"
      aria-label="Video timeline"
      aria-description="Multi-track timeline for video, audio, and text editing"
    >
      {/* Toolbar */}
      <TimelineToolbar
        duration={duration}
        isPlaying={isPlaying}
        isLooping={isLooping}
        tool={tool}
        zoomLevel={zoomLevel}
        selectedClipCount={selectedClipIds.length}
        snapConfig={snapConfig}
        showSnapMenu={showSnapMenu}
        isRendering={isRendering}
        renderProgress={renderProgress}
        renderedPreviewUrl={renderedPreviewUrl}
        isPreviewStale={isPreviewStale}
        isPreviewPlayback={isPreviewPlayback}
        frameRate={frameRate}
        historyCount={historyCount}
        futureCount={futureCount}
        onUndo={onUndo}
        onRedo={onRedo}
        onShowShortcuts={onShowShortcuts}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
        onToggleLoop={onToggleLoop}
        onToolChange={onToolChange}
        onSplitAtPlayhead={() => {
          if (selectedClipIds.length > 0) {
            // La position est LUE au moment de la coupe : c'est la seule ou
            // elle compte, et s'y abonner rendrait la timeline a la frame.
            const position = lirePositionLecture();
            selectedClipIds.forEach((id) => {
              const clip = clips.find((c) => c.id === id);
              if (
                clip &&
                position > clip.start &&
                position < clip.start + clip.duration
              ) {
                onSplitClip(id, position);
              }
            });
          }
        }}
        onZoomChange={onZoomChange}
        onToggleSnap={toggleSnapEnabled}
        onToggleSnapOption={toggleSnapOption}
        onSetGridInterval={setGridInterval}
        onSetShowSnapMenu={setShowSnapMenu}
        onRenderPreview={onRenderPreview}
        onCancelRender={onCancelRender}
        onTogglePreviewPlayback={onTogglePreviewPlayback}
        onAddMarker={onAddMarker}
        onZoomToFit={onZoomToFit}
      />

      <div
        className={`flex-1 flex overflow-hidden relative ${tool === "razor" ? "cursor-crosshair" : ""}`}
        id="timeline-wrapper"
      >
        {/* Track Headers */}
        <div
          ref={headerContainerRef}
          className="w-32 bg-[var(--surface-0)] border-r border-[var(--border-default)] shrink-0 z-20 flex flex-col pt-8 shadow-[4px_0_15px_-5px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          <TimelineTrackHeaders
            tracks={tracks}
            hasClips={!hasNoClips}
            onTrackUpdate={onTrackUpdate}
            onAddTrack={onAddTrack}
            onReorderTracks={onReorderTracks}
          />
        </div>

        {/* Scrollable Timeline */}
        <div
          ref={scrollContainerRef}
          onScroll={() => {
            if (headerContainerRef.current && scrollContainerRef.current) {
              headerContainerRef.current.scrollTop =
                scrollContainerRef.current.scrollTop;
            }
          }}
          className={`flex-1 overflow-x-auto overflow-y-auto relative bg-[var(--surface-0)] ${
            hideScrollbar
              ? "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              : "custom-scrollbar"
          }`}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-clip]")) {
              handleMouseDownBackground(e);
            }
          }}
        >
          {hasNoClips ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                  <FilmIcon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    No clips yet
                  </p>
                  <p className="text-xs mt-1 text-[var(--text-tertiary)]">
                    Drag media from the library or generate content to get
                    started
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Canvas Ruler */}
              <TimelineRuler
                duration={duration}
                zoomLevel={zoomLevel}
                scrollContainerRef={scrollContainerRef}
                onClick={(time) => onSeek(time)}
              />

              {/* Timeline Markers overlay */}
              {markers.length > 0 &&
                onMarkerClick &&
                onMarkerDelete &&
                onMarkerUpdate && (
                  <TimelineMarkers
                    markers={markers}
                    zoomLevel={zoomLevel}
                    scrollLeft={scrollLeft}
                    viewportWidth={viewportWidth}
                    onMarkerClick={onMarkerClick}
                    onMarkerDoubleClick={(marker) =>
                      onMarkerUpdate(marker.id, {})
                    }
                    onMarkerDelete={onMarkerDelete}
                    onMarkerUpdate={onMarkerUpdate}
                  />
                )}

              {/* Tracks Render */}
              <div
                className="min-w-full relative"
                style={{ width: `${totalWidth}px` }}
              >
                {/* Playhead Line (Interactive) */}
                {showPlayhead && (
                  <PlayheadCursor
                    zoomLevel={zoomLevel}
                    isDragging={isDraggingPlayhead}
                    onStartDrag={() => setIsDraggingPlayhead(true)}
                  />
                )}

                {/* Snap Indicator Line */}
                {snapIndicator !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-[1px] bg-yellow-400 z-50 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                    style={{ left: `${snapIndicator * zoomLevel}px` }}
                  />
                )}

                {/* Marquee Selection Box */}
                {selectionBox && (
                  <div
                    className="absolute z-[60] bg-[var(--accent-primary)]/20 border border-[var(--accent-muted)] pointer-events-none"
                    style={{
                      left: selectionBox.x,
                      top: selectionBox.y,
                      width: selectionBox.w,
                      height: selectionBox.h,
                    }}
                  />
                )}

                {/* Track Rows */}
                {tracks.map((track) => {
                  const trackClips = visibleClipsByTrack[track.id] || [];
                  const isAudio = track.type === "audio";
                  const isText = track.type === "text";
                  const trackHeight = isAudio
                    ? "h-11"
                    : isText
                      ? "h-12"
                      : "h-11";

                  const pxParMs = zoomLevel / 1000;
                  const marqueurs =
                    clipWindows &&
                    (track.id === "annotations" || track.id === "video")
                      ? markerGeometry(clipWindows, pxParMs)
                      : [];

                  return (
                    <div
                      key={track.id}
                      className={`${trackHeight} relative group/track bg-[var(--surface-0)]`}
                      onDoubleClick={(e) => handleTrackDoubleClick(e, track)}
                    >
                      <div
                        className="absolute inset-0 bg-[linear-gradient(90deg,transparent_99%,var(--border-subtle)_100%)] opacity-10 pointer-events-none"
                        style={{ backgroundSize: `${zoomLevel}px 100%` }}
                      />

                      {trackClips.map((clip, index) => {
                        const media = mediaMap[clip.mediaId];
                        const isSelected = selectedClipIds.includes(clip.id);

                        return (
                          <TimelineClipItem
                            key={clip.id}
                            clip={clip}
                            media={media}
                            track={track}
                            zoomLevel={zoomLevel}
                            isSelected={isSelected}
                            tool={tool}
                            onMouseDown={(e, mode) =>
                              handleMouseDownClip(e, clip, mode)
                            }
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                clipId: clip.id,
                              });
                              if (!selectedClipIds.includes(clip.id)) {
                                onSelectClips([clip.id]);
                              }
                            }}
                            onKeyDown={(e) => {
                              // existing key handling
                            }}
                            tabIndex={index === 0 ? 0 : -1}
                          />
                        );
                      })}

                      {marqueurs.map((m) => (
                        <TimelineTransitionCard
                          key={`trans-${m.panelIdx}`}
                          marqueur={m}
                          type={
                            clipWindows?.[m.panelIdx]?.transition?.type ??
                            "fade"
                          }
                          zoomLevel={zoomLevel}
                          onResize={onTransitionResize}
                          onTypeChange={onTransitionTypeChange}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <TimelineContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            clipId={contextMenu.clipId}
            clips={clips}
            tracks={tracks}
            currentTime={lirePositionLecture()}
            selectedClipIds={selectedClipIds}
            onSplitClip={onSplitClip}
            onDuplicateClip={onDuplicateClip}
            onDetachAudio={onDetachAudio}
            onRippleDeleteClip={onRippleDeleteClip}
            onDeleteClip={onDeleteClip}
            onExportAudio={onExportAudio}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </div>
  );
});

const COULEUR_PAR_TYPE: Record<string, string> = {
  fade: "#2563eb", // Blue-600
  slideup: "#0284c7", // Sky-600
  slidedown: "#0369a1", // Sky-700
  slideleft: "#0d9488", // Teal-600
  slideright: "#3b82f6", // Blue-500
};

const LIBELLES_TRANSITIONS: { value: string; label: string }[] = [
  { value: "fade", label: "Fondu" },
  { value: "slideup", label: "Glisse vers le haut" },
  { value: "slidedown", label: "Glisse vers le bas" },
  { value: "slideleft", label: "Glisse vers la gauche" },
  { value: "slideright", label: "Glisse vers la droite" },
  { value: "none", label: "Coupe franche (Supprimer)" },
];

function TimelineTransitionCard({
  marqueur,
  type,
  zoomLevel,
  onResize,
  onTypeChange,
}: {
  marqueur: TransitionMarker;
  type: string;
  zoomLevel: number;
  onResize?: (panelIdx: number, durationMs: number) => void;
  onTypeChange?: (panelIdx: number, type: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const pxParMs = zoomLevel / 1000;
  const couleur = COULEUR_PAR_TYPE[type] ?? COULEUR_PAR_TYPE.fade;
  const initialDurationMs = Math.round(marqueur.width / pxParMs);

  useEffect(() => {
    if (showMenu) {
      const handleClose = (e: MouseEvent) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          setShowMenu(false);
        }
      };
      window.addEventListener("mousedown", handleClose);
      return () => window.removeEventListener("mousedown", handleClose);
    }
  }, [showMenu]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pxParMs <= 0 || !onResize) return;

    const x0 = e.clientX;
    const largeurInitialeMs = marqueur.width / pxParMs;
    let latestDureeMs = Math.max(50, Math.round(largeurInitialeMs));
    let rafId: number | null = null;

    const onMove = (ev: MouseEvent) => {
      const deltaMs = (ev.clientX - x0) / pxParMs;
      latestDureeMs = Math.max(50, Math.round(largeurInitialeMs + deltaMs));

      if (cardRef.current) {
        cardRef.current.style.width = `${Math.max(24, latestDureeMs * pxParMs)}px`;
      }
      if (labelRef.current) {
        labelRef.current.textContent = `${type} ${latestDureeMs}ms`;
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          onResize(marqueur.panelIdx, latestDureeMs);
        });
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      onResize(marqueur.panelIdx, latestDureeMs);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={cardRef}
      data-clip="true"
      onClick={(e) => {
        e.stopPropagation();
        import("@/lib/storyboard/store").then((m) => {
          m.useStoryboardStore.getState().setActiveClipIndex(marqueur.panelIdx);
        });
        setShowMenu((prev) => !prev);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      className="absolute top-1 bottom-1 rounded-md z-40 pointer-events-auto flex items-center justify-center border border-blue-300/60 shadow-md transition-all hover:brightness-110 cursor-pointer group/trans-card"
      style={{
        left: `${marqueur.x}px`,
        width: `${Math.max(24, marqueur.width)}px`,
        backgroundColor: couleur,
        opacity: 0.95,
      }}
      title={`Cliquer pour changer la transition : ${type} (${initialDurationMs}ms)`}
    >
      <span
        ref={labelRef}
        className="text-[10px] font-bold text-white uppercase tracking-tighter truncate px-1 select-none pointer-events-none drop-shadow"
      >
        {type} {initialDurationMs}ms
      </span>

      <div
        className="absolute -right-2 top-0 bottom-0 w-4 cursor-ew-resize z-50 flex items-center justify-center group/trans-handle"
        onMouseDown={startDrag}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-1.5 h-6 bg-white rounded-full shadow-md ring-1 ring-black/20 group-hover/trans-handle:scale-125 group-hover/trans-handle:bg-white transition-transform" />
      </div>

      {showMenu && (
        <div
          className="absolute top-full mt-1.5 left-0 z-[100] w-48 bg-[#18181c] border border-white/20 rounded-md shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-75"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-white/10 mb-1">
            Changer la transition
          </div>
          {LIBELLES_TRANSITIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                onTypeChange?.(marqueur.panelIdx, t.value);
                setShowMenu(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 hover:bg-blue-600/30 flex items-center justify-between transition-colors ${
                t.value === type
                  ? "font-bold text-blue-400 bg-blue-500/10"
                  : "text-neutral-200"
              }`}
            >
              <span>{t.label}</span>
              {t.value === type && <span className="text-blue-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
