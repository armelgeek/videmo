"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveVideoFormat } from "@/actions/video-formats/save-video-format";
import type { VideoFormat } from "@/lib/storyboard/formats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** One entry per line, blanks dropped: the shape a structure is read in. */
const toLines = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean);
const fromLines = (items: readonly string[]) => items.join("\n");

const toWords = (text: string) =>
  text.split(",").map((w) => w.trim()).filter(Boolean);
const fromWords = (items: readonly string[]) => items.join(", ");

/** A key is generated from the label so the common case needs no thought. */
const slugify = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

interface FormState {
  key: string;
  label: string;
  hint: string;
  family: "explainer" | "story";
  paragraphs: string;
  defaultTone: string;
  structure: string;
  breakdownRules: string;
  vocabulary: string;
  accentColors: string;
  labels: "every-subject" | "key-subjects" | "none";
  defaultAnimationStyle: string;
  characterName: string;
  characterDescription: string;
}

const EMPTY: FormState = {
  key: "",
  label: "",
  hint: "",
  family: "explainer",
  paragraphs: "8",
  defaultTone: "professional",
  structure: "",
  breakdownRules: "",
  vocabulary: "arrows, circles, boxes",
  accentColors: "red, blue",
  labels: "key-subjects",
  defaultAnimationStyle: "chunkjump",
  characterName: "",
  characterDescription: "",
};

function toFormState(format: VideoFormat): FormState {
  return {
    key: format.id,
    label: format.label,
    hint: format.hint,
    family: format.family,
    paragraphs: String(format.script.paragraphs),
    defaultTone: format.script.defaultTone,
    structure: fromLines(format.script.structure),
    breakdownRules: fromLines(format.breakdown.rules),
    vocabulary: fromWords(format.visual.vocabulary),
    accentColors: fromWords(format.visual.accentColors),
    labels: format.visual.labels,
    defaultAnimationStyle: format.visual.defaultAnimationStyle,
    characterName: format.character?.name ?? "",
    characterDescription: format.character?.description ?? "",
  };
}

interface FormatEditorDialogProps {
  /** The format to start from: an existing one to edit, or one to copy. */
  initial: VideoFormat | null;
  /** True when copying a shipped format: the key is kept, the row is new. */
  isOverride: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Mounted only while open, and keyed by the format being edited: the fields
 * are therefore always fresh, with no state to reset between openings.
 */
export function FormatEditorDialog({
  initial,
  isOverride,
  onOpenChange,
  onSaved,
}: FormatEditorDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    initial ? toFormState(initial) : EMPTY,
  );
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveVideoFormat({
        key: form.key,
        label: form.label,
        hint: form.hint,
        family: form.family,
        thumbnailUrl: initial?.thumbnailUrl || null,
        paragraphs: Number(form.paragraphs),
        structure: toLines(form.structure),
        defaultTone: form.defaultTone,
        breakdownRules: toLines(form.breakdownRules),
        visual: {
          // Derived rather than asked for: a preset id the user never reads.
          id: form.key || "custom",
          vocabulary: toWords(form.vocabulary),
          accentColors: toWords(form.accentColors),
          labels: form.labels,
          defaultAnimationStyle: form.defaultAnimationStyle,
        },
        character:
          form.family === "story" && form.characterDescription.trim()
            ? {
                name: form.characterName.trim() || undefined,
                description: form.characterDescription.trim(),
                referenceImageUrl: initial?.character?.referenceImageUrl ?? "",
              }
            : null,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not save the format");
        return;
      }

      toast.success(`“${form.label}” saved`);
      onOpenChange(false);
      onSaved();
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
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isOverride
              ? "This saves your own copy under the same key. The shipped format stays untouched for everyone else."
              : "The structure steers what the script says; the visual section steers how it is drawn."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6 border rounded-lg bg-card">
          <h3 className="text-sm font-semibold">Identity</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fmt-label">Name</Label>
              <Input
                id="fmt-label"
                value={form.label}
                placeholder="SaaS onboarding"
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
              <Label htmlFor="fmt-key">Key</Label>
              <Input
                id="fmt-key"
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
              <Label htmlFor="fmt-hint">One-line description</Label>
              <Input
                id="fmt-hint"
                value={form.hint}
                placeholder="Walk a new user through first value."
                onChange={(e) => set("hint", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fmt-family">Family</Label>
              <Select
                value={form.family}
                onValueChange={(v) => set("family", v as FormState["family"])}
              >
                <SelectTrigger id="fmt-family">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="explainer">Explainer</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A story carries a recurring character.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fmt-tone">Default tone</Label>
              <Input
                id="fmt-tone"
                value={form.defaultTone}
                placeholder="instructional"
                onChange={(e) => set("defaultTone", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6 border rounded-lg bg-card">
          <h3 className="text-sm font-semibold">Script</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fmt-paragraphs">Paragraphs</Label>
              <Input
                id="fmt-paragraphs"
                type="number"
                min={2}
                max={40}
                value={form.paragraphs}
                onChange={(e) => set("paragraphs", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fmt-structure">Narrative movements</Label>
            <Textarea
              id="fmt-structure"
              rows={7}
              value={form.structure}
              placeholder={"Hook\nProblem\nSolution\nCall to action"}
              onChange={(e) => set("structure", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One per line, in order. This is what makes a format differ from
              another — without it, only the length changes.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-6 border rounded-lg bg-card">
          <h3 className="text-sm font-semibold">Drawing</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fmt-vocabulary">Vocabulary</Label>
              <Input
                id="fmt-vocabulary"
                value={form.vocabulary}
                placeholder="arrows, circles, boxes"
                onChange={(e) => set("vocabulary", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma separated.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fmt-colors">Accent colours</Label>
              <Input
                id="fmt-colors"
                value={form.accentColors}
                placeholder="red, blue"
                onChange={(e) => set("accentColors", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Used sparingly.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fmt-labels">Labelling</Label>
              <Select
                value={form.labels}
                onValueChange={(v) => set("labels", v as FormState["labels"])}
              >
                <SelectTrigger id="fmt-labels">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="every-subject">Label every subject</SelectItem>
                  <SelectItem value="key-subjects">Label key subjects only</SelectItem>
                  <SelectItem value="none">No written labels</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fmt-animation">Animation style</Label>
              <Input
                id="fmt-animation"
                value={form.defaultAnimationStyle}
                onChange={(e) => set("defaultAnimationStyle", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fmt-rules">Breakdown rules</Label>
            <Textarea
              id="fmt-rules"
              rows={4}
              value={form.breakdownRules}
              placeholder={"Show the product UI, never a metaphor\nOne feature per scene"}
              onChange={(e) => set("breakdownRules", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One per line. Added to the rules every format already follows.
            </p>
          </div>
        </div>

        {form.family === "story" && (
          <div className="space-y-4 p-6 border rounded-lg bg-card">
            <h3 className="text-sm font-semibold">Recurring character</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fmt-char-name">Name</Label>
                <Input
                  id="fmt-char-name"
                  value={form.characterName}
                  placeholder="Alex"
                  onChange={(e) => set("characterName", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fmt-char-desc">Description</Label>
              <Textarea
                id="fmt-char-desc"
                rows={3}
                value={form.characterDescription}
                placeholder="A relatable protagonist who experiences the journey"
                onChange={(e) => set("characterDescription", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Repeated word for word in every image prompt, so the same person
                is drawn from the first scene to the last. Leave empty for none.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !form.label.trim()}>
            {isSaving ? "Saving…" : "Save format"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
