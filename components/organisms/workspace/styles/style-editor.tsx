"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveVisualStyle } from "@/actions/visual-styles/save-visual-style";
import { untraceableTermIn } from "@/lib/storyboard/visual-styles/schema";
import type { LabelPolicy, VisualStyle } from "@/lib/storyboard/visual-styles/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipsField } from "@/components/molecules/workspace/chips-field";

import { slugify } from "@/lib/storyboard/slug";
import { ACCENT_HEX, StylePreview } from "@/components/molecules/workspace/style-preview";
import { EditorScreen, PANEL, PanelTitle } from "../editor-screen";

/** The colours the preview and the prompt both understand. */
const ACCENT_SUGGESTIONS = Object.keys(ACCENT_HEX);

const swatchFor = (value: string) => {
  const word = value.toLowerCase();
  const base = ACCENT_SUGGESTIONS.find((name) => word.includes(name));
  return base ? ACCENT_HEX[base] : undefined;
};

const LABEL_CHOICES: { value: LabelPolicy; title: string; hint: string }[] = [
  { value: "every-subject", title: "Every subject", hint: "Each thing drawn gets its word." },
  { value: "key-subjects", title: "Key ones only", hint: "Words where they carry weight." },
  { value: "none", title: "No words", hint: "The drawing speaks alone." },
];

interface FormState {
  key: string;
  label: string;
  hint: string;
  artDirection: string;
  accentColors: string[];
  vocabulary: string[];
  labels: LabelPolicy;
}

const EMPTY: FormState = {
  key: "",
  label: "",
  hint: "",
  artDirection: "",
  accentColors: ["blue"],
  vocabulary: ["arrows", "circles", "boxes"],
  labels: "key-subjects",
};

function toFormState(style: VisualStyle): FormState {
  return {
    key: style.id,
    label: style.label,
    hint: style.hint,
    artDirection: style.artDirection,
    accentColors: [...style.accentColors],
    vocabulary: [...style.vocabulary],
    labels: style.labels,
  };
}

const BACK = "/workspace/brand/styles";

interface StyleEditorProps {
  /** The style to start from: an existing one to edit, or one to copy. */
  initial: VisualStyle | null;
  /** True when copying a shipped style: the key is kept, the row is new. */
  isOverride: boolean;
}

/**
 * Writes a visual style: how the drawings look.
 *
 * Only the free choices are here. The white background, the continuous line and
 * the separated subjects are what the pen animation needs, so they are not
 * something a style can change.
 */
export function StyleEditor({ initial, isOverride }: StyleEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    initial ? toFormState(initial) : EMPTY,
  );
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Shown while typing rather than after a failed save: this is the one field
  // where a user can ask for something the pen cannot draw.
  const untraceable = untraceableTermIn(form.artDirection);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveVisualStyle({
        key: form.key,
        label: form.label,
        hint: form.hint,
        artDirection: form.artDirection.trim(),
        accentColors: form.accentColors,
        vocabulary: form.vocabulary,
        labels: form.labels,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not save the style");
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
    ? "New visual style"
    : isOverride
      ? `Customize “${initial.label}”`
      : `Edit “${initial.label}”`;

  // The same drawing the picker shows, kept in step with the form: a style is
  // written by looking at it, not by imagining it.
  const preview: VisualStyle = {
    id: form.key,
    label: form.label || "Untitled",
    hint: form.hint,
    artDirection: form.artDirection,
    accentColors: form.accentColors,
    vocabulary: form.vocabulary,
    labels: form.labels,
  };

  return (
    <EditorScreen
      backHref={BACK}
      backLabel="Visual styles"
      title={title}
      lede={
        isOverride
          ? "This saves your own copy under the same key. The shipped style stays untouched for everyone else."
          : "How the drawings look. Every style stays a line drawing on a white background, because that is what the pen animation can trace."
      }
      saveLabel="Save style"
      canSave={Boolean(form.label.trim()) && untraceable === null}
      isSaving={isSaving}
      onSave={handleSave}
      aside={
        <figure className={PANEL}>
          <PanelTitle>Preview</PanelTitle>
          <div className="aspect-[180/96] overflow-hidden rounded-lg border-2 border-ink bg-white">
            <StylePreview style={preview} />
          </div>
          <figcaption className="mt-3 text-xs text-muted-foreground">
            A sample drawing, as the picker will show it.
          </figcaption>
        </figure>
      }
    >
      <section className={PANEL}>
        <PanelTitle>Identity</PanelTitle>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sty-label">Name</Label>
            <Input
              id="sty-label"
              value={form.label}
              placeholder="Marker"
              className="h-12 text-lg font-semibold"
              onChange={(e) => {
                const label = e.target.value;
                setForm((f) => ({
                  ...f,
                  label,
                  // Only while creating: changing the key of a saved style
                  // would orphan every project that stores it.
                  key: !initial ? slugify(label) : f.key,
                }));
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sty-hint">One-line description</Label>
            <Input
              id="sty-hint"
              value={form.hint}
              placeholder="Thick, playful felt-tip strokes."
              onChange={(e) => set("hint", e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="sty-key" className="text-xs text-muted-foreground">
              Key
            </Label>
            <Input
              id="sty-key"
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
        <PanelTitle>The hand</PanelTitle>

        <div className="grid gap-2">
          <Label htmlFor="sty-art">Art direction</Label>
          <Textarea
            id="sty-art"
            rows={3}
            value={form.artDirection}
            placeholder="Bold felt-tip marker drawing, thick rounded strokes, chunky simple shapes"
            aria-invalid={untraceable !== null}
            onChange={(e) => set("artDirection", e.target.value)}
          />
          {untraceable ? (
            <p className="text-xs text-destructive" role="alert">
              “{untraceable}” cannot be traced by the pen animation. Describe the
              line work instead.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              The character of the line: its weight, its shapes, its mood. Not a
              medium, a texture or a lighting. The preview follows what you write.
            </p>
          )}
        </div>
      </section>

      <section className={PANEL}>
        <PanelTitle>Colour and vocabulary</PanelTitle>

        <div className="grid gap-6">
          <ChipsField
            id="sty-colors"
            label="Accent colours"
            items={form.accentColors}
            onChange={(items) => set("accentColors", items)}
            suggestions={ACCENT_SUGGESTIONS}
            swatch={swatchFor}
            placeholder="warm orange"
            hint="Small flat touches on otherwise uncoloured line work. Leave it empty for no colour at all."
          />

          <ChipsField
            id="sty-vocab"
            label="Vocabulary"
            items={form.vocabulary}
            onChange={(items) => set("vocabulary", items)}
            placeholder="curved arrows"
            hint="What the drawings are made of. The script's subjects are drawn with these."
          />
        </div>
      </section>

      <section className={PANEL}>
        <PanelTitle>Written words</PanelTitle>

        <div role="radiogroup" aria-label="Written words" className="grid gap-2 sm:grid-cols-3">
          {LABEL_CHOICES.map((choice) => {
            const on = form.labels === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set("labels", choice.value)}
                className={cn(
                  "grid content-start gap-1 rounded-lg border-2 p-3 text-left transition-all",
                  on
                    ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]"
                    : "border-border bg-card hover:border-ink",
                )}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-bold">
                  {choice.title}
                  {on && <span aria-hidden="true">✓</span>}
                </span>
                <span className="text-xs opacity-80">{choice.hint}</span>
              </button>
            );
          })}
        </div>
      </section>
    </EditorScreen>
  );
}
