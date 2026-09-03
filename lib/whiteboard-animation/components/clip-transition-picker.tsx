"use client";

import { useStoryboardStore } from "@/lib/storyboard/store";
import type { TransitionName } from "../timeline/clip-transitions";
import { Label } from "@/components/ui/label";
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

export function ClipTransitionPicker() {
  const panels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const updatePanel = useStoryboardStore((s) => s.updatePanel);

  const panel = panels[activeClipIndex];
  if (!panel) return null;

  const courant: TransitionName = panel.transition?.type ?? "none";

  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor="clip-transition" className="text-xs">
        Transition après ce clip
      </Label>
      <Select
        value={courant}
        onValueChange={(type) =>
          updatePanel(panel.id, {
            transition: {
              type: type as TransitionName,
              durationMs: panel.transition?.durationMs ?? DUREE_PAR_DEFAUT_MS,
            },
          })
        }
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
      <p className="text-xs text-muted-foreground">
        Sa durée est plafonnée au silence disponible avant le clip suivant.
      </p>
    </div>
  );
}
