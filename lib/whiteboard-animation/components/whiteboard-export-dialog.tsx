"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { cn } from "@/lib/utils";

type Quality = "720p" | "1080p";

const QUALITIES: { value: Quality; label: string; detail: string; shortSide: number }[] = [
  { value: "720p", label: "720p", detail: "Faster render", shortSide: 720 },
  { value: "1080p", label: "1080p", detail: "Best quality", shortSide: 1080 },
];

const PRIMARY_BUTTON =
  "w-full border-2 border-ink bg-highlight font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-highlight";

interface WhiteboardExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: (quality: Quality) => void;
  isExporting: boolean;
  exportProgress: number;
  exportPhase: "idle" | "init" | "audio" | "video" | "encoding" | "complete";
  downloadUrl: string | null;
  onCancel: () => void;
  projectTitle: string;
  aspectRatio: string;
  sceneCount: number;
  durationSec: number;
  thumbnailUrl?: string;
}

const CONFETTI_COLORS = ["hsl(var(--highlight))", "hsl(var(--foreground))", "#3b82f6", "#ef4444", "#22c55e"];

/** Pure CSS burst: positions are derived from the index so renders stay deterministic. */
function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
      <style>{`@keyframes sp-confetti{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}`}</style>
      {Array.from({ length: 36 }, (_, i) => {
        const angle = (i / 36) * Math.PI * 2;
        const dist = 90 + ((i * 37) % 70);
        return (
          <span
            key={i}
            className="absolute left-1/2 top-24 block h-2 w-1.5 rounded-[1px] motion-reduce:hidden"
            style={
              {
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                "--dx": `${Math.cos(angle) * dist}px`,
                "--dy": `${Math.sin(angle) * dist + 60}px`,
                "--rot": `${(i * 47) % 360}deg`,
                animation: `sp-confetti 1.1s cubic-bezier(.2,.7,.3,1) ${(i % 6) * 30}ms forwards`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function formatDuration(sec: number) {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function fileNameFor(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${slug || "sketchpilot-video"}.mp4`;
}

export function WhiteboardExportDialog({
  isOpen,
  onClose,
  onStartExport,
  isExporting,
  exportProgress,
  exportPhase,
  downloadUrl,
  onCancel,
  projectTitle,
  aspectRatio,
  sceneCount,
  durationSec,
  thumbnailUrl,
}: WhiteboardExportDialogProps) {
  const { summary } = useCreditSummary();
  const maxShortSide = summary?.maxExportResolution === -1 ? Infinity : (summary?.maxExportResolution ?? 1080);
  const [picked, setQuality] = useState<Quality | null>(null);
  const best: Quality = maxShortSide >= 1080 ? "1080p" : "720p";
  const quality: Quality =
    picked && QUALITIES.find((q) => q.value === picked)!.shortSide <= maxShortSide ? picked : best;

  const running = isExporting || exportPhase === "init" || exportPhase === "encoding";
  const title = projectTitle || "Untitled project";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {downloadUrl ? "Your video is ready" : running ? "Exporting video" : "Export video"}
          </DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2">
          <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md border border-border bg-white">
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt="" className="h-full w-full object-contain" />
            )}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatDuration(durationSec)} · {aspectRatio} · {sceneCount} {sceneCount === 1 ? "scene" : "scenes"}
          </p>
        </div>

        {downloadUrl && <Confetti />}
        {downloadUrl ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
              Available to download for 24 hours.
            </p>
            <Button asChild className={PRIMARY_BUTTON}>
              <a href={downloadUrl} download={fileNameFor(title)}>
                <Download className="mr-2 h-4 w-4" />
                Download MP4
              </a>
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : running ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                {exportPhase === "init" ? "Starting render…" : "Rendering"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(exportProgress)}%
              </span>
            </div>
            <Progress value={exportPhase === "init" ? 0 : exportProgress} aria-label="Export progress" />
            <p className="text-xs text-muted-foreground">
              You can close this window and keep editing. It reopens when the video is ready.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Keep editing
              </Button>
              <Button variant="ghost" className="flex-1 text-destructive hover:text-destructive" onClick={onCancel}>
                Cancel export
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div role="radiogroup" aria-label="Quality" className="grid grid-cols-2 gap-2">
              {QUALITIES.map((q) => {
                const locked = q.shortSide > maxShortSide;
                const active = quality === q.value;
                return (
                  <button
                    key={q.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={locked}
                    onClick={() => setQuality(q.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      active ? "border-foreground bg-muted" : "border-border hover:border-foreground/40",
                    )}
                  >
                    <span className="flex items-center justify-between text-sm font-semibold text-foreground">
                      {q.label}
                      {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {locked ? "Upgrade your plan" : q.detail}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button className={PRIMARY_BUTTON} onClick={() => onStartExport(quality)}>
              Export {quality}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
