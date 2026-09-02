"use client";

import { memo } from "react";
import Image from "next/image";
import { Layers } from "lucide-react";
import { useStoryboardStore } from "@/lib/storyboard/store";
import { DEMO_STORYBOARD } from "@/lib/demo-data";

/** Takes no props and reads the store itself, so a parent re-render — the
 *  editor re-renders on every clip handover — has nothing to tell it. Memoised
 *  to keep ten thumbnails out of that path; store changes still reach it. */
function ClipSelectorBarImpl() {
  const storyboardPanels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const setActiveClipIndex = useStoryboardStore((s) => s.setActiveClipIndex);

  if (!storyboardPanels || storyboardPanels.length === 0) return null;

  return (
    <div className="w-56 shrink-0 h-full border-r border-border/50 pr-2 flex flex-col gap-2 overflow-y-auto">
      <div className="px-2 py-1 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Storyboard Clips ({storyboardPanels.length})
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {storyboardPanels.map((panel, idx) => {
          const isActive = idx === activeClipIndex;
          const displayImage =
            panel.imageUrl ||
            DEMO_STORYBOARD.panels[idx % DEMO_STORYBOARD.panels.length]
              ?.imageUrl;
          const annotationCount = panel.annotations?.length || 0;

          return (
            <button
              key={panel.id || idx}
              onClick={() => setActiveClipIndex(idx)}
              className={`group/clip relative flex flex-col gap-2 p-2 rounded-xl border transition-all text-left ${
                isActive
                  ? "bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40"
                  : "bg-card/40 border-border/50 hover:bg-muted/50 hover:border-border"
              }`}
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/20 border border-border/40 shrink-0 flex items-center justify-center">
                <Image
                  src={displayImage}
                  alt={panel.title || `Clip ${idx + 1}`}
                  fill
                  className="object-cover"
                />
                <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  #{idx + 1}
                </span>
              </div>

              {/* Title & Info */}
              <div className="flex items-center justify-between min-w-0 px-0.5">
                <span
                  className={`text-xs font-semibold truncate ${
                    isActive ? "text-primary font-bold" : "text-foreground"
                  }`}
                >
                  {panel.title || `Clip ${idx + 1}`}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {panel.duration || 5}s
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium flex items-center gap-1">
                    <Layers className="w-2.5 h-2.5" />
                    {annotationCount}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const ClipSelectorBar = memo(ClipSelectorBarImpl);

export default ClipSelectorBar;
