"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listManagedFormats } from "@/actions/video-formats/list-managed-formats";
import { deleteVideoFormat } from "@/actions/video-formats/delete-video-format";
import { isBuiltInFormat } from "@/lib/storyboard/formats";
import type { ManagedFormat, VideoFormat } from "@/lib/storyboard/formats";
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
import { FormatEditorDialog } from "./formats/format-editor-dialog";

interface EditorTarget {
  initial: VideoFormat | null;
  isOverride: boolean;
}

/**
 * The organization's video types.
 *
 * Formats are data: this screen is what makes them editable without a deploy.
 * A shipped format is never written to — customizing one saves the
 * organization's own copy under the same key, which then wins at resolution.
 */
export function FormatsView() {
  const [formats, setFormats] = useState<ManagedFormat[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManagedFormat | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    const result = await listManagedFormats();
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Video formats could not be loaded.");
      setIsLoading(false);
      return;
    }
    setFormats(result.data);
    setCanWrite(Boolean(result.canWrite));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Formats belong to the organization: switching it changes the whole list.
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
      const result = await deleteVideoFormat(pendingDelete.rowId);
      if (!result.success) {
        toast.error(result.error ?? "Could not delete the format");
        return;
      }
      toast.success(
        isBuiltInFormat(pendingDelete.format.id)
          ? `Reverted to the shipped “${pendingDelete.format.label}”`
          : `“${pendingDelete.format.label}” deleted`,
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
          <h1 className="text-2xl font-semibold">Video formats</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The types of video your scripts are written against. Write your own,
            or start from one of ours.
          </p>
        </div>
        <Button
          onClick={() => setEditor({ initial: null, isOverride: false })}
          disabled={!canWrite}
        >
          <Plus className="w-4 h-4 mr-2" />
          New format
        </Button>
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
                  <div>
                    <dt className="inline">Family: </dt>
                    <dd className="inline font-medium">{format.family}</dd>
                  </div>
                  {format.character && (
                    <div>
                      <dt className="inline">Character: </dt>
                      <dd className="inline font-medium">
                        {format.character.name ?? "yes"}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="flex gap-2 mt-auto pt-2">
                  {isOwn ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditor({ initial: format, isOverride: false })}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canWrite}
                      onClick={() => setEditor({ initial: format, isOverride: true })}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Customize
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editor && (
        <FormatEditorDialog
          key={`${editor.initial?.id ?? "new"}:${editor.isOverride}`}
          initial={editor.initial}
          isOverride={editor.isOverride}
          onOpenChange={(open) => !open && setEditor(null)}
          onSaved={load}
        />
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
