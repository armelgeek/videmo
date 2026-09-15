"use client";

import { type ReactElement, useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VideoPreviewDialogProps {
  jobId: string;
  title: string;
  /** The element that opens the preview. */
  children: ReactElement;
}

/** Watch an exported video in place; downloading stays one click away. */
export function VideoPreviewDialog({ jobId, title, children }: VideoPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const fileUrl = `/api/whiteboard/render/${jobId}/file`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>Your latest export, available for 24 hours.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open so closing stops playback. */}
        {open && (
          <video
            src={`${fileUrl}?inline=1`}
            controls
            autoPlay
            playsInline
            className="max-h-[70vh] w-full rounded-lg border border-border bg-black"
          />
        )}
        <a
          href={fileUrl}
          download
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
        >
          <Download className="h-4 w-4" />
          Download MP4
        </a>
      </DialogContent>
    </Dialog>
  );
}
