"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import type { Annotation } from "@/lib/unified-engine/types";
import { deriveTimeline } from "../timeline/derive-timeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ANIM_STYLES = [
  { value: "global", label: "Default" },
  { value: "chunkjump", label: "Chunk Jump" },
  { value: "contour", label: "Contour" },
  { value: "gesture", label: "Gesture" },
  { value: "illust", label: "Illustration" },
  { value: "nervous", label: "Nervous" },
  { value: "outlinechunks", label: "Outline Chunks" },
  { value: "outlinefill", label: "Outline Fill" },
  { value: "outlineonly", label: "Outline Only" },
  { value: "scanner", label: "Scanner" },
  { value: "scribble", label: "Scribble" },
  { value: "specialized", label: "Specialized" },
  { value: "topanchor", label: "Top Anchor" },
] as const;

const TRANSITIONS = [
  { value: "none", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "slideup", label: "Slide up" },
  { value: "slidedown", label: "Slide down" },
  { value: "slideleft", label: "Slide left" },
  { value: "slideright", label: "Slide right" },
] as const;

const DEFAULT_STROKE = "#2563eb";

function formatMs(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export interface AnnotationSequenceListProps {
  /** Every panel's annotations chained, ids prefixed `p{panelIdx}-`. */
  annotations: Annotation[];
  windows: { panelIdx: number; startMs: number; endMs: number }[];
  onTimingChange: (
    panelIdx: number,
    localId: string,
    patch: { durationMs?: number; gapBeforeMs?: number },
  ) => void;
  onStyleChange: (panelIdx: number, localId: string, animStyle: string | undefined) => void;
  onTransitionTypeChange: (panelIdx: number, type: string) => void;
  className?: string;
}

interface Row {
  annotation: Annotation;
  panelIdx: number;
  localId: string;
  localIndex: number;
}

function AnnotationSequenceListImpl({
  annotations,
  windows,
  onTimingChange,
  onStyleChange,
  onTransitionTypeChange,
  className,
}: AnnotationSequenceListProps) {
  const panels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const setActiveClipIndex = useStoryboardStore((s) => s.setActiveClipIndex);
  const isPlaying = useUnifiedEngineStore((s) => s.timeline.isPlaying);
  const togglePlay = useUnifiedEngineStore((s) => s.togglePlay);
  const selectedIndex = useUnifiedEngineStore((s) => s.ui.selectedAnnotationIndex);

  const rowsByPanel = useMemo(() => {
    const byPanel = new Map<number, Row[]>();
    deriveTimeline(annotations).annotations.forEach((annotation) => {
      const match = annotation.id.match(/^p(\d+)-(.*)$/);
      if (!match) return;
      const panelIdx = Number(match[1]);
      const rows = byPanel.get(panelIdx) ?? [];
      rows.push({ annotation, panelIdx, localId: match[2], localIndex: rows.length });
      byPanel.set(panelIdx, rows);
    });
    return byPanel;
  }, [annotations]);

  const totalMs = windows.length ? windows[windows.length - 1].endMs : 0;

  // L'horloge avance a chaque frame : barre, temps et progression se posent hors
  // de React, seule l'annotation en cours passe par l'etat quand elle change.
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const flatRows = useMemo(() => Array.from(rowsByPanel.values()).flat(), [rowsByPanel]);

  useEffect(() => {
    const place = () => {
      const t = useUnifiedEngineStore.getState().timeline.currentTime;
      if (scrubRef.current) scrubRef.current.value = String(t);
      if (timeRef.current) timeRef.current.textContent = formatMs(t);
      const current = flatRows.find(
        ({ annotation }) => t >= annotation.reveal.from && t < annotation.reveal.to,
      );
      const id = current?.annotation.id ?? null;
      setPlayingId((prev) => (prev === id ? prev : id));
      if (current && progressRef.current) {
        const { from, to } = current.annotation.reveal;
        progressRef.current.style.width = `${((t - from) / Math.max(1, to - from)) * 100}%`;
      }
    };
    place();
    return useUnifiedEngineStore.subscribe(place);
  }, [flatRows]);

  const [openScenes, setOpenScenes] = useState<Set<number>>(new Set());
  const toggleScene = (panelIdx: number) =>
    setOpenScenes((prev) => {
      const next = new Set(prev);
      if (next.has(panelIdx)) next.delete(panelIdx);
      else next.add(panelIdx);
      return next;
    });

  const seek = (panelIdx: number, ms: number, localIndex?: number) => {
    setActiveClipIndex(panelIdx);
    // Changer de scene ramene la lecture a son debut (whiteboard-editor-step) :
    // on repose le temps voulu apres ce recalage.
    requestAnimationFrame(() => {
      const engine = useUnifiedEngineStore.getState();
      engine.setCurrentTime(ms);
      if (localIndex !== undefined) engine.setSelectedAnnotation(localIndex);
    });
  };

  return (
    <section className={cn("flex min-h-0 flex-col rounded-lg border bg-card", className)}>
      <div className="flex shrink-0 items-center gap-3 border-b px-3 py-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <span ref={timeRef} className="w-10 text-xs tabular-nums text-muted-foreground">
          0:00
        </span>
        <input
          ref={scrubRef}
          type="range"
          min={0}
          max={Math.max(1, totalMs)}
          step={10}
          defaultValue={0}
          onChange={(e) => useUnifiedEngineStore.getState().setCurrentTime(Number(e.target.value))}
          aria-label="Playback position"
          className="h-1 flex-1 cursor-pointer accent-primary"
        />
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
          {formatMs(totalMs)}
        </span>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {windows.map((w) => {
          const panel = panels[w.panelIdx];
          if (!panel) return null;
          const rows = rowsByPanel.get(w.panelIdx) ?? [];
          const isActive = w.panelIdx === activeClipIndex;
          const open = isActive || openScenes.has(w.panelIdx);
          const isLast = w.panelIdx === windows.length - 1;

          return (
            <li key={panel.id || w.panelIdx} className="border-b border-border/50 last:border-b-0">
              <div className={cn("flex items-center gap-2 px-3 py-2", isActive && "bg-primary/5")}>
                <button
                  type="button"
                  onClick={() => toggleScene(w.panelIdx)}
                  disabled={isActive}
                  aria-label={open ? "Collapse scene" : "Expand scene"}
                  className="text-muted-foreground disabled:opacity-40"
                >
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => seek(w.panelIdx, w.startMs)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="relative h-9 w-16 shrink-0 overflow-hidden rounded border bg-white">
                    {panel.imageUrl && (
                      <img src={panel.imageUrl} alt="" aria-hidden className="h-full w-full object-contain" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {w.panelIdx + 1}. {panel.title || `Scene ${w.panelIdx + 1}`}
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground">
                      {formatMs(w.startMs)} – {formatMs(w.endMs)} · {rows.length} annotations
                    </span>
                  </span>
                </button>
                {!isLast && (
                  <Select
                    value={panel.transition?.type ?? "none"}
                    onValueChange={(type) => onTransitionTypeChange(w.panelIdx, type)}
                  >
                    <SelectTrigger className="h-7 w-28 text-[11px]" aria-label="Transition to next scene">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSITIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {open && (
                <ul className="pb-2">
                  {rows.map(({ annotation, localId, localIndex }) => {
                    const { from, to, durationMs, gapBeforeMs = 0 } = annotation.reveal;
                    const playing = playingId === annotation.id;
                    const selected = isActive && selectedIndex === localIndex;
                    return (
                      <li
                        key={annotation.id}
                        className={cn(
                          "relative mx-2 flex items-center gap-2 overflow-hidden rounded-md px-2 py-1.5",
                          playing ? "bg-primary/10" : selected ? "bg-muted" : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-6 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: annotation.style?.strokeColor ?? DEFAULT_STROKE }}
                        />
                        <button
                          type="button"
                          onClick={() => seek(w.panelIdx, from, localIndex)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-xs">
                            {annotation.text || `Region ${localIndex + 1}`}
                          </span>
                          <span className="block text-[10px] tabular-nums text-muted-foreground">
                            {formatMs(from)} – {formatMs(to)}
                          </span>
                        </button>
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Pause before (s)">
                          wait
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={Number((gapBeforeMs / 1000).toFixed(1))}
                            onChange={(e) =>
                              onTimingChange(w.panelIdx, localId, {
                                gapBeforeMs: Math.max(0, Number(e.target.value) * 1000),
                              })
                            }
                            className="h-6 w-12 rounded border bg-background px-1 text-right text-[11px] text-foreground"
                          />
                        </label>
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Duration (s)">
                          draw
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={Number((durationMs / 1000).toFixed(1))}
                            onChange={(e) =>
                              onTimingChange(w.panelIdx, localId, {
                                durationMs: Math.max(100, Number(e.target.value) * 1000),
                              })
                            }
                            className="h-6 w-12 rounded border bg-background px-1 text-right text-[11px] text-foreground"
                          />
                        </label>
                        <Select
                          value={annotation.animStyle ?? "global"}
                          onValueChange={(val) =>
                            onStyleChange(w.panelIdx, localId, val === "global" ? undefined : val)
                          }
                        >
                          <SelectTrigger className="h-6 w-28 px-2 text-[11px]" aria-label="Animation style">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ANIM_STYLES.map((s) => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {playing && (
                          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/20">
                            <div ref={progressRef} className="h-full bg-primary" />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const AnnotationSequenceList = memo(AnnotationSequenceListImpl);
