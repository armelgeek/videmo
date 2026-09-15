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
      const target = storyboardPanels[idx];
      if (target) {
        engine.setActiveScenePanelId(target.id);
        engine.setSelectedAnnotation(null);
      }
    },
    [setActiveClipIndex, storyboardPanels],
  );

  // Centre la scene active dans la liste a chaque changement — au clic comme
  // au fil de la lecture, ou l'auto-avance de l'editeur change activeClipIndex
  // sans jamais passer par handleSelect. scrollIntoView({block:'nearest'}) ne
  // bouge que si l'element deborde, donc une scene active mais deja visible
  // (en haut ou en bas de la liste) n'etait jamais recentree.
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    const cible =
      active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2;
    list.scrollTo({ top: Math.max(0, cible), behavior: "smooth" });
  }, [activeClipIndex]);

  if (!storyboardPanels || storyboardPanels.length === 0) return null;

  return (
    <div className="w-60 shrink-0 h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold text-foreground">Scenes</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
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
  // React 19 transmet `ref` comme une prop ordinaire aux composants fonction ;
  // forwardRef n'est plus necessaire.
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
              className={`group/clip relative flex flex-col gap-1.5 p-1.5 rounded-lg border transition-colors text-left ${
                isActive
                  ? "bg-primary/10 border-primary/60"
                  : "border-transparent hover:bg-muted/50"
              }`}
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white border border-border/40 shrink-0 flex items-center justify-center">
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  sizes="224px"
                  priority={idx === 0 || isActive}
                  loading={idx === 0 || isActive ? "eager" : "lazy"}
                  className="object-contain"
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
                  {title}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {duration}s
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium flex items-center gap-1">
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
