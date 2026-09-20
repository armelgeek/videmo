"use client";

import { memo, useCallback, useEffect, useRef, type Ref } from "react";
import Image from "next/image";
import { Layers } from "lucide-react";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { DEMO_STORYBOARD } from "@/lib/demo-data";

/** Takes no props and reads the store itself, so a parent re-render — the
 *  editor re-renders on every clip handover — has nothing to tell it. Memoised
 *  to keep ten thumbnails out of that path; store changes still reach it. */
function ClipSelectorBarImpl() {
  const storyboardPanels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const setActiveClipIndex = useStoryboardStore((s) => s.setActiveClipIndex);

  // During playback the active clip FOLLOWS the clock: whiteboard-editor-step
  // resyncs it every frame to the clip being played. A click was thus undone
  // a 16th of a second later. Picking a clip by hand is a navigation intent,
  // not playback: we pause first, then the editor's seek effect brings the
  // playhead onto that clip.
  const handleSelect = useCallback(
    (idx: number) => {
      const engine = useUnifiedEngineStore.getState();
      if (engine.timeline.isPlaying) engine.setIsPlaying(false);
      setActiveClipIndex(idx);
      const target = storyboardPanels[idx];
      if (target) {
        engine.setActiveScenePanelId(target.id);
        engine.setSelectedAnnotation(null);
      }
    },
    [setActiveClipIndex, storyboardPanels],
  );

  // Centre the active scene in the list on every change — on click as well
  // as during playback, where the editor's auto-advance changes activeClipIndex
  // without ever going through handleSelect. scrollIntoView({block:'nearest'})
  // only moves if the element overflows, so an active but already visible scene
  // (at the top or bottom of the list) was never recentred.
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    const targetTop =
      active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2;
    list.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [activeClipIndex]);

  if (!storyboardPanels || storyboardPanels.length === 0) return null;

  return (
    <div className="w-60 shrink-0 h-full flex flex-col rounded-xl border-2 border-ink bg-card shadow-[4px_4px_0_hsl(var(--offset))] overflow-hidden">
      <div className="flex h-11 shrink-0 items-center justify-between border-b-2 border-ink px-3 bg-muted/20">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Scenes</span>
        <span className="rounded-full border border-ink bg-highlight px-2 py-0.5 text-[10px] font-bold tabular-nums text-highlight-foreground shadow-[1px_1px_0_hsl(var(--offset))]">
          {storyboardPanels.length}
        </span>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
        {storyboardPanels.map((panel, idx) => (
          <ClipThumb
            key={panel.id || idx}
            ref={idx === activeClipIndex ? activeRef : undefined}
            idx={idx}
            isActive={idx === activeClipIndex}
            title={panel.title || `Clip ${idx + 1}`}
            duration={panel.duration || 5}
            annotationCount={panel.annotations?.length || 0}
            imageUrl={
              panel.imageUrl ||
              DEMO_STORYBOARD.panels[idx % DEMO_STORYBOARD.panels.length]
                ?.imageUrl
            }
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface ClipThumbProps {
  idx: number;
  isActive: boolean;
  title: string;
  duration: number;
  annotationCount: number;
  imageUrl: string;
  onSelect: (idx: number) => void;
  // React 19 passes `ref` as an ordinary prop to function components;
  // forwardRef is no longer needed.
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One rail entry, memoised on primitives. Selecting a clip changes exactly two
 * of them — the one leaving and the one arriving — but the rail re-rendered all
 * ten, thumbnails included, which was the second cost of every switch. The
 * click handler takes the index rather than closing over it, so the identity
 * stays stable and memo actually holds.
 */
const ClipThumb = memo(function ClipThumb({
  idx,
  isActive,
  title,
  duration,
  annotationCount,
  imageUrl,
  onSelect,
  ref,
}: ClipThumbProps) {
  return (
            <button
              ref={ref}
              onClick={() => onSelect(idx)}
              // Hundreds of scenes: off-screen entries skip layout and paint.
              style={{ contentVisibility: "auto", containIntrinsicSize: "auto 160px" }}
              className={`group/clip relative flex flex-col gap-1.5 p-1.5 rounded-lg border-2 transition-all text-left ${
                isActive
                  ? "border-ink bg-highlight/15 shadow-[2px_2px_0_hsl(var(--offset))] -translate-y-0.5"
                  : "border-transparent hover:border-border hover:bg-muted/40"
              }`}
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white border border-border shrink-0 flex items-center justify-center">
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  sizes="224px"
                  priority={idx === 0 || isActive}
                  loading={idx === 0 || isActive ? "eager" : "lazy"}
                  className="object-contain"
                />
                <span className="absolute top-1.5 left-1.5 border border-ink bg-highlight text-highlight-foreground text-[10px] font-bold px-1.5 py-0.5 rounded shadow-[1px_1px_0_hsl(var(--offset))]">
                  #{idx + 1}
                </span>
              </div>

              {/* Title & Info */}
              <div className="flex items-center justify-between min-w-0 px-0.5">
                <span
                  className={`text-xs font-semibold truncate ${
                    isActive ? "text-foreground font-bold" : "text-foreground/90"
                  }`}
                >
                  {title}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {duration}s
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-border bg-accent text-foreground font-semibold flex items-center gap-1">
                    <Layers className="w-2.5 h-2.5" />
                    {annotationCount}
                  </span>
                </div>
              </div>
            </button>
  );
});

export const ClipSelectorBar = memo(ClipSelectorBarImpl);

export default ClipSelectorBar;
