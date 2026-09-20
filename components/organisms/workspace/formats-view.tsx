"use client";

import Link from "next/link";
import { Plus, Copy, Pencil, Trash2 } from "lucide-react";
import { listManagedFormats } from "@/actions/video-formats/list-managed-formats";
import { deleteVideoFormat } from "@/actions/video-formats/delete-video-format";
import { isBuiltInFormat } from "@/lib/storyboard/formats";
import type { ManagedFormat } from "@/lib/storyboard/formats";
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
import { useManagedCollection } from "@/hooks/use-managed-collection";

/**
 * The organization's video types.
 *
 * Formats are data: this screen is what makes them editable without a deploy.
 * A shipped format is never written to — customizing one saves the
 * organization's own copy under the same key, which then wins at resolution.
 */
export function FormatsView() {
  const {
    items: formats,
    canWrite,
    isLoading,
    pendingDelete,
    setPendingDelete,
    isDeleting,
    confirmDelete,
  } = useManagedCollection<ManagedFormat>({
    fetchList: listManagedFormats,
    deleteItem: deleteVideoFormat,
    isBuiltIn: isBuiltInFormat,
    getItemId: (entry) => entry.format.id,
    getItemLabel: (entry) => entry.format.label,
    getItemRowId: (entry) => entry.rowId,
    errorMessage: "Video formats could not be loaded.",
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Video formats</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The types of video your scripts are written against. Write your own,
            or start from one of ours.
          </p>
        </div>
        {/* `disabled` does nothing to an anchor, so without an organization the
            button is rendered as a plain one that goes nowhere. */}
        {canWrite ? (
          <Button asChild>
            <Link href="/workspace/formats/new">
              <Plus className="w-4 h-4 mr-2" />
              New format
            </Link>
          </Button>
        ) : (
          <Button disabled>
            <Plus className="w-4 h-4 mr-2" />
            New format
          </Button>
        )}
      </header>

      {!isLoading && !canWrite && (
        <p className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
          Select an organization to write your own formats. Until then you can
          only use the ones shipped with the product.
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {formats.map((entry) => {
            const { format, isOwn, rowId } = entry;
            const isCustomized = isOwn && isBuiltInFormat(format.id);

            return (
              <article
                key={format.id}
                className="p-5 border rounded-lg bg-card flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{format.label}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{format.hint}</p>
                  </div>
                  <Badge variant={isOwn ? "default" : "secondary"}>
                    {isCustomized ? "Customized" : isOwn ? "Yours" : "Shipped"}
                  </Badge>
                </div>

                <dl className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <dt className="inline">Paragraphs: </dt>
                    <dd className="inline font-medium">{format.script.paragraphs}</dd>
                  </div>
                  <div>
                    <dt className="inline">Movements: </dt>
                    <dd className="inline font-medium">{format.script.structure.length}</dd>
                  </div>
                  {format.usesCharacter && (
                    <div>
                      <dt className="inline">Character: </dt>
                      <dd className="inline font-medium">recurring</dd>
                    </div>
                  )}
                </dl>

                <div className="flex gap-2 mt-auto pt-2">
                  {isOwn ? (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/workspace/formats/${format.id}/edit`}>
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
                        <Link href={`/workspace/formats/${format.id}/edit`}>
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete && isBuiltInFormat(pendingDelete.format.id)
                ? `Revert “${pendingDelete.format.label}”?`
                : `Delete “${pendingDelete?.format.label}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && isBuiltInFormat(pendingDelete.format.id)
                ? "Your changes are dropped and the shipped format comes back. Projects keep working."
                : "Projects already written against this format keep their script, and fall back to the default the next time they generate."}
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
