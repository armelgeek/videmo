"use client";

import { memo } from "react";
import { useStoryboardStore } from "@/lib/storyboard/store";
import type { TransitionName, ClipWindow } from "../timeline/clip-transitions";
import { toEngineAnnotations, toStoredAnnotations } from "../timeline/annotation-interop";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Transition de SORTIE du clip actif : ce qui se passe apres lui. */
const NOMS: { value: TransitionName; label: string }[] = [
  { value: "none", label: "Coupe franche" },
  { value: "fade", label: "Fondu" },
  { value: "slideup", label: "Glisse vers le haut" },
  { value: "slidedown", label: "Glisse vers le bas" },
  { value: "slideleft", label: "Glisse vers la gauche" },
  { value: "slideright", label: "Glisse vers la droite" },
];

const DUREE_PAR_DEFAUT_MS = 300;

export interface ClipTransitionPickerProps {
  clips?: ClipWindow[];
}

function ClipTransitionPickerImpl({ clips }: ClipTransitionPickerProps) {
  const panels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const updatePanel = useStoryboardStore((s) => s.updatePanel);

  const panel = panels[activeClipIndex];
  const nextPanel = panels[activeClipIndex + 1];

  if (!panel) return null;

  const isLastClip = !nextPanel;
  const courant: TransitionName = panel.transition?.type ?? "none";

  const clip = clips?.[activeClipIndex];
  const nextClip = clips?.[activeClipIndex + 1];
  const blanc = nextClip && clip ? Math.max(0, nextClip.startMs - clip.endMs) : 0;

  const updateTransitionAndGap = (type: TransitionName, durationMs: number) => {
    const targetDuration = type === "none" ? durationMs : Math.max(50, durationMs);
    updatePanel(panel.id, {
      transition: {
        type,
        durationMs: targetDuration,
      },
    });

    if (type !== "none" && nextPanel) {
      const deltaNeeded = targetDuration - blanc;
      if (deltaNeeded !== 0) {
        const anns = toEngineAnnotations(nextPanel.annotations ?? []);
        if (anns.length > 0) {
          const currentGap = anns[0].reveal.gapBeforeMs ?? 0;
          const newGap = Math.max(50, currentGap + deltaNeeded);
          anns[0] = {
            ...anns[0],
            reveal: { ...anns[0].reveal, gapBeforeMs: newGap },
          };
          const updatedStored = toStoredAnnotations(anns);
          updatePanel(nextPanel.id, { annotations: updatedStored });

          if (activeClipIndex + 1 === useStoryboardStore.getState().activeClipIndex) {
            useUnifiedEngineStore.getState().setAnnotations(anns);
          }
        }
      }
    }
  };

  const handleSelectTransition = (typeStr: string) => {
    const type = typeStr as TransitionName;
    const durationMs = panel.transition?.durationMs ?? (blanc > 0 ? blanc : DUREE_PAR_DEFAUT_MS);
    updateTransitionAndGap(type, durationMs);
  };

  const handleDurationChange = (durationMs: number) => {
    const targetType = courant === "none" ? "fade" : courant;
    updateTransitionAndGap(targetType, durationMs);
  };

  if (isLastClip) {
    return (
      <div className="space-y-2 border-t pt-3 opacity-60">
        <Label className="text-xs">Transition après ce clip</Label>
        <p className="text-xs text-muted-foreground">
          Dernier clip du projet : aucune transition de sortie.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor="clip-transition" className="text-xs">
        Transition après ce clip
      </Label>
      <Select
        value={courant}
        onValueChange={handleSelectTransition}
      >
        <SelectTrigger id="clip-transition">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NOMS.map((n) => (
            <SelectItem key={n.value} value={n.value}>
              {n.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {courant !== "none" ? (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="clip-transition-duration" className="text-[11px] text-muted-foreground">
              Durée (ms)
            </Label>
            <span className="text-[10px] text-muted-foreground">Silence: {blanc}ms</span>
          </div>
          <Input
            id="clip-transition-duration"
            type="number"
            min={50}
            max={10000}
            step={50}
            value={panel.transition?.durationMs ?? DUREE_PAR_DEFAUT_MS}
            onChange={(e) => {
              const val = Math.max(50, Number(e.target.value) || 0);
              handleDurationChange(val);
            }}
            className="h-8 text-xs"
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Coupe franche immédiate au clip suivant.
        </p>
      )}
    </div>
  );
}

/** Ne suit pas l'horloge : memo evite un re-rendu au rythme de son parent. */
export const ClipTransitionPicker = memo(ClipTransitionPickerImpl);


