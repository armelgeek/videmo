"use client";

import { Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ScriptScene } from "@/lib/storyboard/script-generation";

const TYPE_STYLES: Record<ScriptScene["clipType"], string> = {
  intro: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  content: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  outro: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export interface SceneCardProps {
  scene: ScriptScene;
  onChange: (updates: Partial<ScriptScene>) => void;
  /** Absent sur la derniere scene : un script vide n'a rien a valider. */
  onRemove?: () => void;
}

/**
 * Une scene, editable champ par champ.
 *
 * `imagePrompt` est expose ici a dessein : c'est le seul endroit ou le corriger
 * avant que l'etape suivante ne s'en serve pour produire un visuel.
 */
export function SceneCard({ scene, onChange, onRemove }: SceneCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {String(scene.index + 1).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0",
            TYPE_STYLES[scene.clipType],
          )}
        >
          {scene.clipType}
        </span>
        <Input
          value={scene.title}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-label={`Scene ${scene.index + 1} title`}
          className="h-7 border-0 bg-transparent px-1 font-medium focus-visible:ring-1"
        />
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number"
            min={1}
            value={scene.duration}
            onChange={(event) =>
              onChange({ duration: Number(event.target.value) || 1 })
            }
            aria-label={`Scene ${scene.index + 1} duration in seconds`}
            className="h-7 w-16 text-xs"
          />
          <span className="text-xs text-muted-foreground">s</span>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove scene ${scene.index + 1}`}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Narration</Label>
          <Textarea
            value={scene.narration}
            onChange={(event) => onChange({ narration: event.target.value })}
            rows={3}
            className="text-sm resize-y"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Image prompt</Label>
          <Textarea
            value={scene.imagePrompt}
            onChange={(event) => onChange({ imagePrompt: event.target.value })}
            rows={2}
            className="text-sm resize-y font-mono text-foreground/80"
          />
        </div>
      </div>
    </div>
  );
}
