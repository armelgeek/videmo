"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { saveVisualStyle } from "@/actions/visual-styles/save-visual-style";
import { untraceableTermIn } from "@/lib/storyboard/visual-styles/schema";
import type { LabelPolicy, VisualStyle } from "@/lib/storyboard/visual-styles/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { slugify } from "@/lib/storyboard/slug";

const toWords = (text: string) =>
  text.split(",").map((w) => w.trim()).filter(Boolean);
const fromWords = (items: readonly string[]) => items.join(", ");

interface FormState {
  key: string;
  label: string;
  hint: string;
  artDirection: string;
  accentColors: string;
  vocabulary: string;
  labels: LabelPolicy;
}

const EMPTY: FormState = {
  key: "",
  label: "",
  hint: "",
  artDirection: "",
  accentColors: "blue",
  vocabulary: "arrows, circles, boxes",
  labels: "key-subjects",
};

function toFormState(style: VisualStyle): FormState {
  return {
    key: style.id,
    label: style.label,
    hint: style.hint,
    artDirection: style.artDirection,
    accentColors: fromWords(style.accentColors),
    vocabulary: fromWords(style.vocabulary),
    labels: style.labels,
  };
}

const BACK = "/workspace/styles";

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
        accentColors: toWords(form.accentColors),
        vocabulary: toWords(form.vocabulary),
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div>
        <Link
          href={BACK}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Visual styles
        </Link>
        <h1 className="text-2xl font-semibold mt-3">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isOverride
            ? "This saves your own copy under the same key. The shipped style stays untouched for everyone else."
            : "How the drawings look. Every style stays a line drawing on a white background, because that is what the pen animation can trace."}
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-start">
        <section className="space-y-4 p-6 border rounded-lg bg-card">
          <h2 className="text-sm font-semibold">Identity</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sty-label">Name</Label>
              <Input
                id="sty-label"
                value={form.label}
                placeholder="Marker"
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
              <Label htmlFor="sty-key">Key</Label>
              <Input
                id="sty-key"
                value={form.key}
                disabled={initial !== null}
                onChange={(e) => set("key", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {initial
                  ? "Fixed: projects are stored against it."
                  : "Lowercase letters, digits and dashes."}
              </p>
            </div>

            <div className="col-span-1 md:col-span-2 grid gap-2">
              <Label htmlFor="sty-hint">One-line description</Label>
              <Input
                id="sty-hint"
                value={form.hint}
                placeholder="Thick, playful felt-tip strokes."
                onChange={(e) => set("hint", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 p-6 border rounded-lg bg-card">
          <h2 className="text-sm font-semibold">Drawing</h2>

          <div className="grid gap-2">
            <Label htmlFor="sty-art">Art direction</Label>
            <Textarea
              id="sty-art"
              rows={4}
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
                The character of the line: its weight, its shapes, its mood. Not
                a medium, a texture or a lighting.
              </p>
            )}
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sty-colors">Accent colours</Label>
              <Input
                id="sty-colors"
                value={form.accentColors}
                placeholder="orange, teal"
                onChange={(e) => set("accentColors", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Small flat touches. Leave empty for line work only.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sty-vocab">Vocabulary</Label>
              <Input
                id="sty-vocab"
                value={form.vocabulary}
                placeholder="arrows, circles, boxes"
                onChange={(e) => set("vocabulary", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">What it is drawn with.</p>
            </div>

            <div className="col-span-1 md:col-span-2 grid gap-2">
              <Label htmlFor="sty-labels">Written words</Label>
              <Select value={form.labels} onValueChange={(v) => set("labels", v as LabelPolicy)}>
                <SelectTrigger id="sty-labels">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="every-subject">Label every subject</SelectItem>
                  <SelectItem value="key-subjects">Label the key subjects only</SelectItem>
                  <SelectItem value="none">No written words at all</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" asChild disabled={isSaving}>
          <Link href={BACK}>Cancel</Link>
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !form.label.trim() || untraceable !== null}
        >
          {isSaving ? "Saving…" : "Save style"}
        </Button>
      </div>
    </div>
  );
}
