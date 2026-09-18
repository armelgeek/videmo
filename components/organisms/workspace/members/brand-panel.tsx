"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, ImageUp, Loader2, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL } from "./types";

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg"];

interface BrandPanelProps {
  organizationId: string;
  initialLogo: string | null;
  onLogoChange?: (logo: string | null) => void;
  className?: string;
}

export function BrandPanel({
  organizationId,
  initialLogo,
  onLogoChange,
  className,
}: BrandPanelProps) {
  const { summary } = useCreditSummary();
  const [logo, setLogo] = useState(initialLogo);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!summary) {
    return (
      <section className={cn(PANEL, "space-y-4", className)}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
      </section>
    );
  }

  const included = summary.features.customBranding;

  const processFile = async (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("Invalid file format. Please upload a PNG or JPEG image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("File is too large. Maximum size is 1 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    await sendLogoRequest("POST", file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (busy || !included) return;

    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!busy && included) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const sendLogoRequest = async (method: "POST" | "DELETE", file?: File) => {
    setBusy(true);
    try {
      const body = file ? new FormData() : undefined;
      if (file && body) body.append("file", file);

      const res = await fetch(`/api/organizations/${organizationId}/logo`, { method, body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not update the logo");
      }

      const updatedLogo = data.logo ?? null;
      setLogo(updatedLogo);
      onLogoChange?.(updatedLogo);
      toast.success(updatedLogo ? "Logo saved. It now appears on your exports." : "Logo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the logo");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section className={cn(PANEL, "flex flex-col justify-between gap-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Brand logo</h2>
            {included && logo && (
              <Badge variant="outline" className="gap-1 text-[10px] font-semibold text-muted-foreground">
                <Check className="size-3 text-highlight" /> Active
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Appears automatically in the watermark corner of all exported videos.
          </p>
        </div>

        {!included && (
          <Badge variant="secondary" className="gap-1 text-[10px] font-bold uppercase">
            <Sparkles className="size-3" /> Enterprise
          </Badge>
        )}
      </div>

      {!included ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-full border-2 border-ink bg-card shadow-[2px_2px_0_hsl(var(--offset))]">
            <Sparkles className="size-5 text-highlight" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">Custom branding is locked</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Upgrade to Enterprise to watermark all video renders with your organization&apos;s identity.
          </p>
          <Button asChild size="sm" variant="secondary" className="mt-4">
            <Link href="/billing#plans">View Enterprise plans</Link>
          </Button>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            id="brand-logo-file-input"
            disabled={busy}
            onChange={handleFileChange}
          />

          {logo ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "relative flex flex-col sm:flex-row items-center gap-4 rounded-lg border-2 p-4 transition-all",
                isDragging
                  ? "border-highlight bg-highlight/10 shadow-[4px_4px_0_hsl(var(--offset))]"
                  : "border-border bg-card/60",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {/* Preview container with checkerboard subtle backdrop for transparency */}
              <div className="relative flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- bucket URL */}
                <img
                  src={logo}
                  alt="Current brand logo"
                  className="max-h-20 max-w-36 object-contain drop-shadow-sm"
                />
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-xs">
                    <Loader2 className="size-5 animate-spin text-foreground" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col items-start gap-2">
                <p className="text-xs text-muted-foreground">
                  Drop a new PNG or JPEG (max 1 MB) to replace, or use the buttons below.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm" disabled={busy} className="cursor-pointer">
                    <label htmlFor="brand-logo-file-input">
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
                      Replace
                    </label>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void sendLogoRequest("DELETE")}
                    disabled={busy}
                    className="text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <label
              htmlFor="brand-logo-file-input"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all",
                isDragging
                  ? "border-highlight bg-highlight/15 shadow-[4px_4px_0_hsl(var(--offset))] -translate-y-0.5"
                  : "border-border bg-muted/20 hover:border-ink hover:bg-muted/40",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs transition-transform group-hover:scale-105">
                {busy ? (
                  <Loader2 className="size-5 animate-spin text-foreground" />
                ) : (
                  <UploadCloud className="size-5 text-foreground" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {isDragging ? "Drop your logo here" : "Click to upload or drag & drop"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG or JPEG (max 1 MB) · Transparent background recommended
              </p>
            </label>
          )}
        </div>
      )}
    </section>
  );
}
