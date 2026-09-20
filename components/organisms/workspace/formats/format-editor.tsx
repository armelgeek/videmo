"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { saveVideoFormat } from "@/actions/video-formats/save-video-format";
import type { VideoFormat } from "@/lib/storyboard/formats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

/** One entry per line, blanks dropped: the shape a structure is read in. */
const toLines = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean);
const fromLines = (items: readonly string[]) => items.join("\n");

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
  paragraphs: string;
  defaultTone: string;
  structure: string;
  breakdownRules: string;
  usesCharacter: boolean;
}

const EMPTY: FormState = {
  key: "",
  label: "",
  hint: "",
  paragraphs: "8",
  defaultTone: "professional",
  structure: "",
  breakdownRules: "",
  usesCharacter: false,
};

function toFormState(format: VideoFormat): FormState {
  return {
    key: format.id,
    label: format.label,
    hint: format.hint,
    paragraphs: String(format.script.paragraphs),
    defaultTone: format.script.defaultTone,
    structure: fromLines(format.script.structure),
    breakdownRules: fromLines(format.breakdown.rules),
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveVideoFormat({
        key: form.key,
        label: form.label,
        hint: form.hint,
        thumbnailUrl: initial?.thumbnailUrl ?? null,
        paragraphs: Number(form.paragraphs),
        structure: toLines(form.structure),
        defaultTone: form.defaultTone,
        breakdownRules: toLines(form.breakdownRules),
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div>
        <Link
          href={BACK}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Formats
        </Link>
        <h1 className="text-2xl font-semibold mt-3">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isOverride
            ? "This saves your own copy under the same key. The shipped format stays untouched for everyone else."
            : "The structure steers what the script says. How the video looks is chosen separately."}
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-start">
        <section className="space-y-4 p-6 border rounded-lg bg-card">
          <h2 className="text-sm font-semibold">Identity</h2>
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
              <Label htmlFor="fmt-tone">Default tone</Label>
              <Input
                id="fmt-tone"
                value={form.defaultTone}
                placeholder="instructional"
                onChange={(e) => set("defaultTone", e.target.value)}
              />
            </div>

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

            <div className="col-span-1 md:col-span-2 flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="grid gap-1">
                <Label htmlFor="fmt-character">Recurring character</Label>
                <p className="text-xs text-muted-foreground">
                  The video follows one character, picked from your library when
                  the project is created and drawn the same way in every scene.
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

        <section className="space-y-4 p-6 border rounded-lg bg-card">
          <h2 className="text-sm font-semibold">Script</h2>

          <div className="grid gap-2">
            <Label htmlFor="fmt-structure">Narrative movements</Label>
            <Textarea
              id="fmt-structure"
              rows={9}
              value={form.structure}
              placeholder={"Hook\nProblem\nSolution\nCall to action"}
              onChange={(e) => set("structure", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One per line, in order. This is what makes a format differ from
              another — without it, only the length changes.
            </p>
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
        </section>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" asChild disabled={isSaving}>
          <Link href={BACK}>Cancel</Link>
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !form.label.trim()}>
          {isSaving ? "Saving…" : "Save format"}
        </Button>
      </div>
    </div>
  );
}
