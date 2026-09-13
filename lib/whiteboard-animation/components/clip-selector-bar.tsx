"use client";

import { memo, useCallback } from "react";
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

  // Pendant la lecture, le clip actif SUIT l'horloge : whiteboard-editor-step
  // le recale a chaque frame sur le clip joue. Un clic etait donc annule au
  // 16e de seconde suivant. Choisir un clip a la main est une intention de
  // navigation, pas de lecture : on met en pause d'abord, l'effet de seek de
  // l'editeur amene ensuite la tete de lecture sur ce clip.
  const handleSelect = useCallback(
    (idx: number) => {
      const engine = useUnifiedEngineStore.getState();
      if (engine.timeline.isPlaying) engine.setIsPlaying(false);
      setActiveClipIndex(idx);
    },
    [setActiveClipIndex],
  );

  if (!storyboardPanels || storyboardPanels.length === 0) return null;

  return (
    <div className="w-60 shrink-0 h-full flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold text-foreground">Scenes</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {storyboardPanels.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
        {storyboardPanels.map((panel, idx) => (
          <ClipThumb
            key={panel.id || idx}
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
}: ClipThumbProps) {
  return (
            <button
              onClick={() => onSelect(idx)}
              className={`group/clip flex items-center gap-2.5 rounded-lg border p-1.5 text-left transition-colors ${
                isActive ? "bg-primary/10 border-primary/60" : "border-transparent hover:bg-muted/50"
              }`}
            >
              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md border border-border/40 bg-white">
                <Image src={imageUrl} alt={title} fill sizes="80px" className="object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`line-clamp-2 text-xs leading-snug ${isActive ? "font-semibold text-foreground" : "text-foreground/90"}`}>
                  <span className="mr-1 tabular-nums text-muted-foreground">{idx + 1}.</span>
                  {title}
                </p>
                <p className="mt-1 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
                  <span>{duration}s</span>
                  <span className="flex items-center gap-0.5">
                    <Layers className="h-2.5 w-2.5" />
                    {annotationCount}
                  </span>
                </p>
              </div>
            </button>
  );
});

export const ClipSelectorBar = memo(ClipSelectorBarImpl);

export default ClipSelectorBar;
