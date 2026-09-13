"use client";

import { memo, useState } from "react";
import { Check, ChevronDown, ChevronRight, ImageIcon, Pencil } from "lucide-react";
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
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  if (!panel) return null;

  const prompt = panel.visualPrompt || panel.prompt || "";
  const description = panel.narration || "";

  return (
    <section className={cn("shrink-0 rounded-xl border border-border bg-card overflow-hidden", className)}>
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

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setDescriptionOpen((open) => !open)}
            aria-expanded={descriptionOpen}
            className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {descriptionOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Description
          </button>
          {!descriptionOpen ? (
            <button
              type="button"
              onClick={() => setDescriptionOpen(true)}
              className="w-full truncate px-1 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              {description || "What is said during this scene..."}
            </button>
          ) : editing === "description" ? (
            <Textarea
              autoFocus
              value={description}
              onChange={(e) => updatePanel(panel.id, { narration: e.target.value })}
              onBlur={() => setEditing(null)}
              className="field-sizing-fixed h-28 min-h-0 resize-none overflow-y-auto text-xs leading-relaxed"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing("description")}
              className="max-h-32 w-full overflow-y-auto rounded-md px-1 py-0.5 text-left text-xs leading-relaxed text-muted-foreground hover:bg-muted/30"
            >
              {description || "What is said during this scene..."}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export const SceneDetailsPanel = memo(SceneDetailsPanelImpl);
