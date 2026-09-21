"use client";

import Link from "next/link";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SketchHint } from "@/components/molecules/sketch-hint";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { useManagedCollection } from "@/hooks/use-managed-collection";

const CARD =
  "rounded-lg border-2 border-ink bg-card shadow-[5px_5px_0_hsl(var(--offset))]";
const PRIMARY =
  "inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none";
const ACTION =
  "inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none";

/** A card's facts row: short, scannable, one chip each. */
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-accent px-2 py-0.5 text-[10px] font-semibold text-foreground">
      {children}
    </span>
  );
}

/** What the screen needs to draw a row, whatever the row actually is. */
interface Entry {
  id: string;
  label: string;
  hint: string;
  rowId: string | null;
  isOwn: boolean;
}

interface CollectionScreenProps<T> {
  title: string;
  lede: string;
  /** The brand-kit tab row, rendered under the header. */
  tabs?: React.ReactNode;
  /** The handwritten nudge next to the title. */
  nudge: string;
  noun: string;
  newHref: string;
  editHref: (id: string) => string;
  collection: ReturnType<typeof useManagedCollection<T>>;
  isBuiltIn: (id: string) => boolean;
  toEntry: (item: T) => Entry;
  /** A sample of the thing itself, drawn at the top of the card. */
  media?: (item: T) => React.ReactNode;
  facts?: (item: T) => React.ReactNode;
  /** Shown under the header when there is no organization to write into. */
  readOnlyNote: string;
  revertDescription: string;
  deleteDescription: string;
}

/**
 * The formats and styles screens: the same screen twice, over rows an
 * organization either uses as shipped, overrides, or wrote itself.
 *
 * Only the words and the facts row differ between them, so they live here
 * rather than in two files that drift apart.
 */
export function CollectionScreen<T>({
  title,
  lede,
  tabs,
  nudge,
  noun,
  newHref,
  editHref,
  collection,
  isBuiltIn,
  toEntry,
  media,
  facts,
  readOnlyNote,
  revertDescription,
  deleteDescription,
}: CollectionScreenProps<T>) {
  const { items, canWrite, isLoading, pendingDelete, setPendingDelete, isDeleting, confirmDelete } =
    collection;

  const pending = pendingDelete ? toEntry(pendingDelete) : null;
  const pendingIsBuiltIn = pending ? isBuiltIn(pending.id) : false;

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pt-4 sm:px-8">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">
              <span className="sk-marker">{title}</span>
            </h1>
            <SketchHint direction="left" className="hidden text-lg sm:flex">
              {nudge}
            </SketchHint>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{lede}</p>
        </div>

        {/* `disabled` does nothing to an anchor, so with no organization to
            write into the button is a plain one that goes nowhere. */}
        {canWrite ? (
          <Link href={newHref} className={PRIMARY}>
            <Plus className="h-4 w-4" />
            New {noun}
          </Link>
        ) : (
          <button type="button" disabled className={PRIMARY}>
            <Plus className="h-4 w-4" />
            New {noun}
          </button>
        )}
      </header>

      {tabs}

      <div className="space-y-6 px-6 py-8 sm:px-8">
        {!isLoading && !canWrite && (
          <p className="rounded-lg border-2 border-dashed border-border bg-accent/40 p-4 text-sm text-muted-foreground">
            {readOnlyNote}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading
            ? [0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={cn(CARD, "h-40 animate-pulse bg-muted/40")} />
              ))
            : items.map((item, index) => {
                const { id, label, hint, rowId, isOwn } = toEntry(item);
                const isCustomized = isOwn && isBuiltIn(id);

                return (
                  <article
                    key={id}
                    className={cn(
                      CARD,
                      "group flex flex-col overflow-hidden transition-transform hover:rotate-0 hover:-translate-y-1",
                      // Pinned to the wall by hand, not laid out by a grid.
                      index % 3 === 0 ? "-rotate-[0.6deg]" : index % 3 === 1 ? "rotate-[0.5deg]" : "-rotate-[0.2deg]",
                    )}
                  >
                    {media && (
                      <div className="aspect-[180/96] border-b-2 border-ink bg-white">
                        {media(item)}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
                      <div className="min-w-0">
                        <h2 className="truncate font-hand text-xl leading-none text-foreground">
                          {label}
                        </h2>
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{hint}</p>
                      </div>
                      {isOwn && (
                        <span className="shrink-0 rounded-full border border-ink bg-highlight px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-highlight-foreground">
                          {isCustomized ? "Yours" : "New"}
                        </span>
                      )}
                    </div>

                    {facts && <div className="flex flex-wrap gap-1 px-3 pt-2">{facts(item)}</div>}

                    {/* The actions stay out of the way until the card is aimed at. */}
                    <div className="mt-auto flex items-center gap-1 px-2 pb-2 pt-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      {isOwn ? (
                        <>
                          <Link href={editHref(id)} className={ACTION}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                          <button
                            type="button"
                            disabled={!rowId}
                            onClick={() => setPendingDelete(item)}
                            className={cn(ACTION, "border-transparent shadow-none hover:bg-accent")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {isCustomized ? "Revert" : "Delete"}
                          </button>
                        </>
                      ) : canWrite ? (
                        <Link href={editHref(id)} className={ACTION}>
                          <Copy className="h-3.5 w-3.5" />
                          Make it mine
                        </Link>
                      ) : (
                        <span className="px-1 text-[11px] italic text-muted-foreground">
                          shipped with the product
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="border-2 border-ink shadow-[5px_5px_0_hsl(var(--offset))]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingIsBuiltIn ? `Revert “${pending?.label}”?` : `Delete “${pending?.label}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingIsBuiltIn ? revertDescription : deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
