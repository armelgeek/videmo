"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveVideoFormat } from "@/actions/video-formats/save-video-format";
import type { VideoFormat } from "@/lib/storyboard/formats";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LineListField } from "@/components/molecules/workspace/line-list-field";

import { slugify } from "@/lib/storyboard/slug";
import { EditorScreen, PANEL, PanelTitle } from "../editor-screen";

/** The tones the shipped formats are written in. Anything else can be typed. */
const TONES = [
  "professional",
  "instructional",
  "narrative",
  "persuasive",
  "explanatory",
  "casual",
];

interface FormState {
  key: string;
  label: string;
  hint: string;
  paragraphs: number;
  defaultTone: string;
  structure: string[];
  breakdownRules: string[];
  usesCharacter: boolean;
}

const EMPTY: FormState = {
  key: "",
  label: "",
  hint: "",
  paragraphs: 8,
  defaultTone: "professional",
  structure: [""],
  breakdownRules: [""],
  usesCharacter: false,
};

function toFormState(format: VideoFormat): FormState {
  return {
    key: format.id,
    label: format.label,
    hint: format.hint,
    paragraphs: format.script.paragraphs,
    defaultTone: format.script.defaultTone,
    structure: [...format.script.structure],
    breakdownRules: [...format.breakdown.rules],
    usesCharacter: format.usesCharacter,
  };
}

const BACK = "/workspace/formats";

interface FormatEditorProps {
  /** The format to start from: an existing one to edit, or one to copy. */
  initial: VideoFormat | null;
  /** True when copying a shipped format: the key is kept, the row is new. */
  isOverride: boolean;
}

/**
 * Writes a video format: what a script is about, in which order, for how long.
 *
 * How the video LOOKS is not decided here — that is the whiteboard style,
 * picked separately, so any type of video works with any look.
 */
export function FormatEditor({ initial, isOverride }: FormatEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    initial ? toFormState(initial) : EMPTY,
  );
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const isCustomTone = !TONES.includes(form.defaultTone);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveVideoFormat({
        key: form.key,
        label: form.label,
        hint: form.hint,
        // Nothing renders it, but an override must not silently drop what the
        // format it copies already had.
        thumbnailUrl: initial?.thumbnailUrl ?? null,
        paragraphs: form.paragraphs,
        structure: form.structure.map((s) => s.trim()).filter(Boolean),
        defaultTone: form.defaultTone,
        breakdownRules: form.breakdownRules.map((r) => r.trim()).filter(Boolean),
        usesCharacter: form.usesCharacter,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not save the format");
        return;
      }

      toast.success(`“${form.label}” saved`);
      router.push(BACK);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const title = !initial
    ? "New video format"
    : isOverride
      ? `Customize “${initial.label}”`
      : `Edit “${initial.label}”`;

  return (
    <EditorScreen
      backHref={BACK}
      backLabel="Formats"
      title={title}
      lede={
        isOverride
          ? "This saves your own copy under the same key. The shipped format stays untouched for everyone else."
          : "The structure steers what the script says. How the video looks is chosen separately."
      }
      saveLabel="Save format"
      canSave={Boolean(form.label.trim())}
      isSaving={isSaving}
      onSave={handleSave}
    >
      <section className={PANEL}>
        <PanelTitle>Identity</PanelTitle>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fmt-label">Name</Label>
            <Input
              id="fmt-label"
              value={form.label}
              placeholder="SaaS onboarding"
              className="h-12 text-lg font-semibold"
              onChange={(e) => {
                const label = e.target.value;
                setForm((f) => ({
                  ...f,
                  label,
                  // Only while creating: changing the key of a saved format
                  // would orphan every project that stores it.
                  key: !initial ? slugify(label) : f.key,
                }));
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fmt-hint">One-line description</Label>
            <Input
              id="fmt-hint"
              value={form.hint}
              placeholder="Walk a new user through first value."
              onChange={(e) => set("hint", e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="fmt-key" className="text-xs text-muted-foreground">
              Key
            </Label>
            <Input
              id="fmt-key"
              value={form.key}
              disabled={initial !== null}
              onChange={(e) => set("key", e.target.value)}
              className="h-8 w-48 font-mono text-xs shadow-none"
            />
            <span className="text-xs text-muted-foreground">
              {initial
                ? "Fixed: projects are stored against it."
                : "Lowercase letters, digits and dashes."}
            </span>
          </div>
        </div>
      </section>

      <section className={PANEL}>
        <PanelTitle>Length and tone</PanelTitle>

        <div className="grid gap-6">
          <div className="grid gap-2">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-4xl font-bold leading-none text-foreground">
                {form.paragraphs}
              </span>
              <Label htmlFor="fmt-paragraphs" className="text-sm text-muted-foreground">
                paragraphs of script
              </Label>
            </div>
            <input
              id="fmt-paragraphs"
              type="range"
              min={2}
              max={40}
              value={form.paragraphs}
              onChange={(e) => set("paragraphs", Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full border-2 border-ink bg-accent accent-[hsl(var(--highlight))]"
            />
            <p className="text-xs text-muted-foreground">
              Roughly one scene each. Short formats land harder; long ones teach.
            </p>
          </div>

          <div className="grid gap-2">
            <span id="fmt-tone-label" className="text-sm font-medium">
              Default tone
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="fmt-tone-label">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  aria-pressed={form.defaultTone === tone}
                  onClick={() => set("defaultTone", tone)}
                  className={cn(
                    "rounded-full border-2 px-3 py-1 text-xs font-semibold transition-transform hover:-translate-y-px",
                    form.defaultTone === tone
                      ? "border-ink bg-highlight text-highlight-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-ink hover:text-foreground",
                  )}
                >
                  {tone}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={isCustomTone}
                onClick={() => set("defaultTone", isCustomTone ? "professional" : "")}
                className={cn(
                  "rounded-full border-2 border-dashed px-3 py-1 text-xs font-semibold transition-transform hover:-translate-y-px",
                  isCustomTone
                    ? "border-ink bg-highlight text-highlight-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-ink hover:text-foreground",
                )}
              >
                Something else
              </button>
            </div>
            {isCustomTone && (
              <Input
                aria-label="Default tone"
                value={form.defaultTone}
                placeholder="deadpan"
                onChange={(e) => set("defaultTone", e.target.value)}
                className="mt-1 h-9 w-56"
              />
            )}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border-2 border-dashed border-border p-4">
            <div className="grid gap-1">
              <Label htmlFor="fmt-character">Recurring character</Label>
              <p className="text-xs text-muted-foreground">
                The video follows one character, picked from your library when the
                project is created and drawn the same way in every scene.
              </p>
            </div>
            <Switch
              id="fmt-character"
              checked={form.usesCharacter}
              onCheckedChange={(v) => set("usesCharacter", v)}
            />
          </div>
        </div>
      </section>

      <section className={PANEL}>
        <PanelTitle>The script it writes</PanelTitle>
        <LineListField
          id="fmt-structure"
          label="Narrative movements"
          ordered
          items={form.structure}
          onChange={(items) => set("structure", items)}
          placeholder="Hook (why care)"
          addLabel="Add a movement"
          hint="In order, one beat each. This is what makes a format differ from another — without it, only the length changes."
        />
      </section>

      <section className={PANEL}>
        <PanelTitle>Breakdown rules</PanelTitle>
        <LineListField
          id="fmt-rules"
          label="What the split must respect"
          items={form.breakdownRules}
          onChange={(items) => set("breakdownRules", items)}
          placeholder="One feature per scene"
          addLabel="Add a rule"
          hint="Added to the rules every format already follows."
        />
      </section>
    </EditorScreen>
  );
}
