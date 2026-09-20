"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listManagedVisualStyles } from "@/actions/visual-styles/list-visual-styles";
import { deleteVisualStyle } from "@/actions/visual-styles/delete-visual-style";
import { isBuiltInVisualStyle } from "@/lib/storyboard/visual-styles/built-in";
import type { ManagedVisualStyle } from "@/lib/storyboard/visual-styles/types";
import { ORGANIZATION_CHANGED_EVENT } from "@/lib/app-shell/organization-events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const LABEL_SUMMARY = {
  "every-subject": "every subject labelled",
  "key-subjects": "key labels only",
  none: "no written words",
} as const;

/**
 * The organization's visual styles.
 *
 * Styles are data: this screen is what makes them editable without a deploy. A
 * shipped style is never written to — customizing one saves the organization's
 * own copy under the same key, which then wins at resolution.
 */
export function StylesView() {
  const [styles, setStyles] = useState<ManagedVisualStyle[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ManagedVisualStyle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    const result = await listManagedVisualStyles();
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Visual styles could not be loaded.");
      setIsLoading(false);
      return;
    }
    setStyles(result.data);
    setCanWrite(Boolean(result.canWrite));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Styles belong to the organization: switching it changes the whole list.
    const onChange = () => {
      setIsLoading(true);
      load();
    };
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
  }, [load]);

  const confirmDelete = async () => {
    if (!pendingDelete?.rowId) return;
    setIsDeleting(true);
    try {
      const result = await deleteVisualStyle(pendingDelete.rowId);
      if (!result.success) {
        toast.error(result.error ?? "Could not delete the style");
        return;
      }
      toast.success(
        isBuiltInVisualStyle(pendingDelete.style.id)
          ? `Reverted to the shipped “${pendingDelete.style.label}”`
          : `“${pendingDelete.style.label}” deleted`,
      );
      setPendingDelete(null);
      load();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Visual styles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            How the drawings look. Write your own, or start from one of ours.
          </p>
        </div>
        {/* `disabled` does nothing to an anchor, so without an organization the
            button is rendered as a plain one that goes nowhere. */}
        {canWrite ? (
          <Button asChild>
            <Link href="/workspace/styles/new">
              <Plus className="w-4 h-4 mr-2" />
              New style
            </Link>
          </Button>
        ) : (
          <Button disabled>
            <Plus className="w-4 h-4 mr-2" />
            New style
          </Button>
        )}
      </header>

      {!isLoading && !canWrite && (
        <p className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
          Select an organization to write your own styles. Until then you can only
          use the ones shipped with the product.
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-lg border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {styles.map((entry) => {
            const { style, isOwn, rowId } = entry;
            const isCustomized = isOwn && isBuiltInVisualStyle(style.id);

            return (
              <article key={style.id} className="p-5 border rounded-lg bg-card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{style.label}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{style.hint}</p>
                  </div>
                  <Badge variant={isOwn ? "default" : "secondary"}>
                    {isCustomized ? "Customized" : isOwn ? "Yours" : "Shipped"}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">{style.artDirection}</p>

                <dl className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <dt className="inline">Accents: </dt>
                    <dd className="inline font-medium">
                      {style.accentColors.length > 0 ? style.accentColors.join(", ") : "line work only"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Words: </dt>
                    <dd className="inline font-medium">{LABEL_SUMMARY[style.labels]}</dd>
                  </div>
                </dl>

                <div className="flex gap-2 mt-auto pt-2">
                  {isOwn ? (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/workspace/styles/${style.id}/edit`}>
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!rowId}
                        onClick={() => setPendingDelete(entry)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        {isCustomized ? "Revert" : "Delete"}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" asChild={canWrite} disabled={!canWrite}>
                      {canWrite ? (
                        <Link href={`/workspace/styles/${style.id}/edit`}>
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Customize
                        </Link>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Customize
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete && isBuiltInVisualStyle(pendingDelete.style.id)
                ? `Revert “${pendingDelete.style.label}”?`
                : `Delete “${pendingDelete?.style.label}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && isBuiltInVisualStyle(pendingDelete.style.id)
                ? "Your changes are dropped and the shipped style comes back. Projects keep working."
                : "Projects already using this style keep their images, and fall back to the default the next time they generate."}
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
