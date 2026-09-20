"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HandArrow } from "@/components/organisms/landing/sketch/hand-arrow";
import { Segmented } from "./settings-controls";
import { useVideoFormats } from "@/hooks/use-video-formats";
import { useVisualStyles } from "@/hooks/use-visual-styles";
import type { VideoFormat } from "@/lib/storyboard/formats";
import type { VisualStyle } from "@/lib/storyboard/visual-styles/types";
import type { ProjectParams } from "@/lib/storyboard/schema";
import { cn } from "@/lib/utils";

type Props = {
  brief: string;
  onBriefChange: (v: string) => void;
  params: ProjectParams;
  onParamsChange: (p: ProjectParams) => void;
  voice: string;
  onVoiceChange: (v: string) => void;
  onPreviewVoice: (v: string) => void;
  previewingVoice: string | null;
  onGenerate: (brief: string) => void;
  isGenerating?: boolean;
  aside?: React.ReactNode;
};

const STEPS = [
  { key: "type", label: "Type", question: ["What kind of", "video?"], note: "it decides how the script is built" },
  { key: "about", label: "About", question: ["What's your video", "about?"], note: "then set the screen and the length" },
  { key: "visual", label: "Visual", question: ["How should it", "look?"], note: "the look of every drawing" },
  { key: "voice", label: "Voice", question: ["Who's", "speaking?"], note: "pick the language, then the voice" },
] as const;

/** The brief is what every later step depends on, so it is the gate. */
const ABOUT_INDEX = STEPS.findIndex((s) => s.key === "about");

const EXAMPLES = [
  { label: "New billing, 90s", text: "Introduce our new billing in 90 seconds: the problem, one-click export, and what it changes for the finance team." },
  { label: "Onboarding in 3 steps", text: "Show new users how onboarding works in 3 simple steps." },
  { label: "v2 launch teaser", text: "A LinkedIn teaser for our v2 launch: what's new for customers." },
];

const VOICES = [
  { id: "coral", name: "Coral", gender: "female" },
  { id: "nova", name: "Nova", gender: "female" },
  { id: "sage", name: "Sage", gender: "female" },
  { id: "shimmer", name: "Shimmer", gender: "female" },
  { id: "ash", name: "Ash", gender: "male" },
  { id: "ballad", name: "Ballad", gender: "male" },
  { id: "echo", name: "Echo", gender: "male" },
  { id: "fable", name: "Fable", gender: "male" },
  { id: "onyx", name: "Onyx", gender: "male" },
  { id: "verse", name: "Verse", gender: "male" },
  { id: "alloy", name: "Alloy", gender: "neutral" },
] as const;

const RATIOS = [
  { value: "16:9", hint: "YouTube, website", w: 16, h: 9 },
  { value: "9:16", hint: "Reels, Shorts, TikTok", w: 9, h: 16 },
  { value: "1:1", hint: "LinkedIn and Instagram feeds", w: 12, h: 12 },
] as const;

const VOICE_GROUPS = [
  { key: "female", label: "Female voices" },
  { key: "male", label: "Male voices" },
  { key: "neutral", label: "Neutral voice" },
] as const;
const LANGUAGES = [
  ["en", "English", "🇬🇧"], ["fr", "French", "🇫🇷"], ["es", "Spanish", "🇪🇸"], ["de", "German", "🇩🇪"],
  ["it", "Italian", "🇮🇹"], ["pt", "Portuguese", "🇵🇹"], ["zh", "Chinese", "🇨🇳"], ["ja", "Japanese", "🇯🇵"],
] as const;

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function PromptWizard({
  brief,
  onBriefChange,
  params,
  onParamsChange,
  voice,
  onVoiceChange,
  onPreviewVoice,
  previewingVoice,
  onGenerate,
  isGenerating = false,
  aside,
}: Props) {
  const [index, setIndex] = useState(0);
  // Both lists start on the shipped rows so a picker is never empty, then swap
  // in what the organization actually has: its own rows and its overrides.
  const { formats } = useVideoFormats({ withFallback: true });
  const { styles } = useVisualStyles({ withFallback: true });
  const step = STEPS[index];
  const hasBrief = brief.trim().length > 0;
  const isLast = index === STEPS.length - 1;
  const set = (patch: Partial<ProjectParams>) => onParamsChange({ ...params, ...patch });
  const currentLanguage = LANGUAGES.find(([code]) => code === params.language)?.[1] ?? "English";

  // Picking a type comes before the brief exists; every step after it needs one.
  const canAdvance = index < ABOUT_INDEX || hasBrief;

  const next = () => {
    if (!canAdvance || isGenerating) return;
    if (isLast) onGenerate(brief);
    else setIndex((i) => i + 1);
  };

  return (
    <div className={cn("mx-auto grid w-full gap-5", aside ? "max-w-7xl" : "max-w-3xl")}>
      {/* Question + light progress, distinct from the page step indicator */}
      <div className="grid justify-items-center gap-2 text-center">
        <div className="flex items-center gap-3">
          <span className="sk-scribble text-base">
            question {index + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const reachable = i <= ABOUT_INDEX || hasBrief;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => reachable && setIndex(i)}
                  disabled={!reachable}
                  aria-label={`Go to ${s.label}`}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "h-2 rounded-full border-[1.5px] border-ink transition-all disabled:cursor-not-allowed",
                    i === index ? "w-9 bg-highlight" : i < index ? "w-5 bg-ink" : "w-5 bg-transparent opacity-40",
                  )}
                />
              );
            })}
          </div>
        </div>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
          {step.question[0]} <span className="sk-marker">{step.question[1]}</span>
        </h1>
        <div className="flex items-end gap-1" aria-hidden="true">
          <span className="sk-scribble -rotate-2">{step.note}</span>
          <span className="w-9 translate-y-2">
            <HandArrow variant="down-left" className="sk-hand-arrow" />
          </span>
        </div>
      </div>

      {index > ABOUT_INDEX && (
        <button
          type="button"
          onClick={() => setIndex(ABOUT_INDEX)}
          className="group mx-auto flex max-w-xl items-center gap-2 rounded-md bg-highlight px-3 py-1.5 text-left text-sm text-highlight-foreground shadow-[2px_3px_0_hsl(0_0%_0%/0.2)] -rotate-1"
        >
          <span className="line-clamp-1">
            <b>{formats.find((f) => f.id === params.format)?.label ?? params.format}:</b> “{brief}”
          </span>
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
          <span className="sr-only">Edit the brief</span>
        </button>
      )}

      <div className={cn(aside && "grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,1fr)]")}>
      <section className="sk-sheet grid gap-5 p-5 sm:p-6">
        <span className="sk-tape" aria-hidden="true" />

        {step.key === "about" && (
          <>
            <textarea
              autoFocus
              value={brief}
              onChange={(e) => onBriefChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  next();
                }
              }}
              rows={4}
              aria-label="Describe your video"
              placeholder="The message, the key points, who it's for…"
              className="min-h-0 w-full resize-none rounded-lg border-2 border-dashed border-border bg-transparent p-3 text-base leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ink"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="sk-scribble text-base">or try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => onBriefChange(ex.text)}
                  className="rounded-full border-2 border-border bg-card px-3 py-1 text-xs font-medium hover:border-ink"
                >
                  {ex.label}
                </button>
              ))}
            </div>
            <div className="grid gap-4 border-t-2 border-dashed border-border pt-4 sm:grid-cols-2">
              <Field title="Format">
                <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-2">
                  {RATIOS.map((r) => {
                    const on = r.value === params.aspectRatio;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        title={r.hint}
                        onClick={() => set({ aspectRatio: r.value })}
                        className={cn(
                          "flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-all",
                          on
                            ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]"
                            : "border-border bg-card hover:border-ink",
                        )}
                      >
                        <span aria-hidden="true" className="block rounded-[2px] border-2 border-current" style={{ width: r.w, height: r.h }} />
                        {r.value}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{RATIOS.find((r) => r.value === params.aspectRatio)?.hint}</p>
              </Field>
              <div className="sm:col-span-2">
                <Field title="Length">
                  <Segmented
                    label="Length"
                    value={params.duration}
                    onChange={(v) => set({ duration: v })}
                    options={[
                      { value: "1-2 minutes", label: "1–2 min" },
                      { value: "2-3 minutes", label: "2–3 min" },
                      { value: "3-5 minutes", label: "3–5 min" },
                      { value: "5-10 minutes", label: "5–10 min" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          </>
        )}



        {step.key === "type" && (
          <div role="radiogroup" aria-label="Video type" className="grid gap-3 sm:grid-cols-2">
            {formats.map((f) => {
              const on = f.id === params.format;
              const movements = f.script.structure.map((m) => m.replace(/\s*\(.*\)$/, ""));
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ format: f.id })}
                  className={cn(
                    "grid content-start gap-1.5 rounded-lg border-2 p-4 text-left transition-all",
                    on
                      ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]"
                      : "border-border bg-card hover:border-ink",
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-base font-bold">
                    {f.label}
                    {on && <span aria-hidden="true">✓</span>}
                  </span>
                  <span className="text-sm">{f.hint}</span>
                  {movements.length > 0 && (
                    <span className="line-clamp-2 text-xs opacity-70">
                      {movements.slice(0, 5).join(" → ")}
                      {movements.length > 5 ? " → …" : ""}
                    </span>
                  )}
                  <span className="text-[11px] font-mono uppercase tracking-[0.1em] opacity-60">
                    ~{f.script.paragraphs} paragraphs{f.usesCharacter ? " · recurring character" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step.key === "visual" && (
          <div role="radiogroup" aria-label="Visual style" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {styles.map((st) => {
              const on = st.id === params.visualStyle;
              return (
                <button
                  key={st.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ visualStyle: st.id })}
                  className={cn(
                    "grid content-start gap-2 rounded-lg border-2 p-4 text-left transition-all",
                    on
                      ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]"
                      : "border-border bg-card hover:border-ink",
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-base font-bold">
                    {st.label}
                    {on && <span aria-hidden="true">✓</span>}
                  </span>
                  <span className="text-sm">{st.hint}</span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.1em] opacity-60">
                    {st.labels === "none" ? "no written words" : st.labels === "key-subjects" ? "key labels" : "every subject labelled"}
                    {st.accentColors.length > 0 ? ` · ${st.accentColors.join(", ")}` : " · line work only"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step.key === "voice" && (
          <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
            {/* Languages: vertical list */}
            <div role="radiogroup" aria-label="Language" className="grid content-start gap-1.5 sm:border-r-2 sm:border-dashed sm:border-border sm:pr-5">
              <p className="mb-1 text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">Language</p>
              {LANGUAGES.map(([code, label, flag]) => {
                const on = code === params.language;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ language: code })}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-left text-sm font-medium transition-all",
                      on
                        ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))] translate-x-1"
                        : "border-transparent hover:border-border hover:bg-card",
                    )}
                  >
                    <span aria-hidden="true" className="text-lg leading-none">{flag}</span>
                    <span className="flex-1">{label}</span>
                    {on && <ArrowRight className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>

            {/* Voices for the selected language */}
            <div className="grid content-start gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold">
                  Voices in <span className="sk-marker">{currentLanguage}</span>
                </p>
                <span className="sk-scribble text-sm">▶ to hear them speak {currentLanguage}</span>
              </div>
              {VOICE_GROUPS.map((group) => (
                <div key={group.key} role="radiogroup" aria-label={group.label} className="grid gap-2">
                  <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                    {VOICES.filter((v) => v.gender === group.key).map((v) => {
                      const on = v.id === voice;
                      const playing = previewingVoice === v.id;
                      const busy = previewingVoice !== null && !playing;
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            "flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 transition-all",
                            on
                              ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]"
                              : "border-border bg-card hover:border-ink",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => onPreviewVoice(v.id)}
                            disabled={busy}
                            aria-label={`Listen to ${v.name} in ${currentLanguage}`}
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink transition-transform hover:scale-105 disabled:opacity-40",
                              playing ? "bg-ink text-background" : on ? "bg-card text-foreground" : "bg-highlight text-highlight-foreground",
                            )}
                          >
                            {playing ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onVoiceChange(v.id)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-1 text-left text-sm font-bold"
                          >
                            <span className="truncate">{playing ? "speaking…" : v.name}</span>
                            {on && <span aria-hidden="true">✓</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-border pt-4">
          {index > 0 ? (
            <Button variant="ghost" onClick={() => setIndex((i) => i - 1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">You can change it later</span>
          )}
          <div className="flex items-center gap-3">
            {!isLast && hasBrief && (
              <button
                type="button"
                onClick={() => onGenerate(brief)}
                disabled={isGenerating}
                className="text-sm font-medium text-muted-foreground underline decoration-highlight decoration-2 underline-offset-4 hover:text-foreground disabled:opacity-40"
              >
                Skip &amp; generate
              </button>
            )}
            <Button variant="secondary" onClick={next} disabled={!canAdvance || isGenerating}>
              {isLast ? "Generate my script" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
        {aside && <aside className="relative lg:sticky lg:top-6">{aside}</aside>}
      </div>
    </div>
  );
}
