"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const PANEL =
  "rounded-lg border-2 border-ink bg-card p-5 shadow-[5px_5px_0_hsl(var(--offset))]";
const PRIMARY =
  "inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none";
const SECONDARY =
  "inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** A panel's heading: the same small caps as the rest of the workspace. */
export function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h2>
  );
}

interface EditorScreenProps {
  backHref: string;
  backLabel: string;
  title: string;
  lede: string;
  saveLabel: string;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  /** The form panels. */
  children: React.ReactNode;
  /** What the thing will look like, kept in view while it is written. */
  aside?: React.ReactNode;
}

/**
 * The format and style editors: a form on the left, what it produces on the
 * right, and the same save bar at the bottom of both.
 */
export function EditorScreen({
  backHref,
  backLabel,
  title,
  lede,
  saveLabel,
  canSave,
  isSaving,
  onSave,
  children,
  aside,
}: EditorScreenProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-6 py-4 sm:px-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          <span className="sk-marker">{title}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{lede}</p>
      </header>

      <div
        className={cn(
          "grid flex-1 items-start gap-6 px-6 py-8 sm:px-8",
          aside ? "lg:grid-cols-[minmax(0,1fr)_300px]" : "mx-auto w-full max-w-3xl",
        )}
      >
        <div className="grid gap-6">{children}</div>
        {aside && <div className="lg:sticky lg:top-8">{aside}</div>}
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t-2 border-ink bg-background/95 px-6 py-3 backdrop-blur sm:px-8">
        <Link href={backHref} className={SECONDARY}>
          Cancel
        </Link>
        <button type="button" onClick={onSave} disabled={!canSave || isSaving} className={PRIMARY}>
          {isSaving ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
