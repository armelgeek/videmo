"use client";

import { memo, useState } from "react";
import { Check, ImageIcon, Mic, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useStoryboardStore } from "@/lib/storyboard/store";

type Field = "prompt" | "description";

/** What the active scene should show and say, editable in place. */
function SceneDetailsPanelImpl({ className }: { className?: string }) {
  const panel = useStoryboardStore((s) => s.storyboardPanels[s.activeClipIndex]);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const updatePanel = useStoryboardStore((s) => s.updatePanel);
  const [editing, setEditing] = useState<Field | null>(null);

  if (!panel) return null;

  const prompt = panel.visualPrompt || panel.prompt || "";
  const description = panel.narration || "";

  return (
    <section className={cn("shrink-0 rounded-lg border border-border bg-card overflow-hidden", className)}>
      <header className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="rounded bg-muted px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {activeClipIndex + 1}
        </span>
        <span className="truncate text-xs font-semibold text-foreground">
          {panel.title || `Scene ${activeClipIndex + 1}`}
        </span>
      </header>

      <div className="space-y-3 p-3">
        <div className="group/field space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Image prompt
            </span>
            {editing === "prompt" ? (
              <button type="button" onClick={() => setEditing(null)} className="flex items-center gap-1 text-[11px] text-primary">
                <Check className="h-3 w-3" />
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing("prompt")}
                aria-label="Edit image prompt"
                className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/field:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          {editing === "prompt" ? (
            <Textarea
              autoFocus
              value={prompt}
              onChange={(e) => updatePanel(panel.id, { visualPrompt: e.target.value })}
              onBlur={() => setEditing(null)}
              className="field-sizing-fixed h-28 min-h-0 resize-none overflow-y-auto text-xs leading-relaxed"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("prompt")}
              className="line-clamp-4 w-full rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs leading-relaxed text-foreground transition-colors hover:border-primary/60"
            >
              {prompt || <span className="text-muted-foreground">What the visual should show...</span>}
            </button>
          )}
        </div>

        <div className="group/field space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              <Mic className="h-3.5 w-3.5 text-primary" />
              Narration
            </span>
            {editing === "description" ? (
              <button type="button" onClick={() => setEditing(null)} className="flex items-center gap-1 text-[11px] text-primary">
                <Check className="h-3 w-3" />
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing("description")}
                aria-label="Edit narration"
                className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/field:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          {/* Grows with its text: the side panel scrolls, never a box inside it. */}
          {editing === "description" ? (
            <Textarea
              autoFocus
              value={description}
              onChange={(e) => updatePanel(panel.id, { narration: e.target.value })}
              onBlur={() => setEditing(null)}
              className="field-sizing-content min-h-20 resize-none overflow-hidden text-xs leading-relaxed"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("description")}
              className="w-full whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-xs leading-relaxed text-foreground transition-colors hover:border-foreground/30"
            >
              {description || <span className="text-muted-foreground">What is said during this scene...</span>}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export const SceneDetailsPanel = memo(SceneDetailsPanelImpl);
