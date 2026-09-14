"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProjectThumbnailProps {
  previewUrl: string | null;
  aspectRatio: string;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ProjectThumbnail({
  previewUrl,
  aspectRatio,
  compact = false,
  className,
  children,
}: ProjectThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(previewUrl) && !failed;
  const isLandscape = aspectRatio === "16:9";

  return (
    <div className={cn("relative aspect-video overflow-hidden bg-card", className)}>
      {showImage ? (
        isLandscape ? (
          <img
            src={previewUrl as string}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <>
            <img
              src={previewUrl as string}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
            />
            <img
              src={previewUrl as string}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
              className="relative mx-auto h-full object-contain"
            />
          </>
        )
      ) : (
        <BlankBoard compact={compact} />
      )}
      {children}
    </div>
  );
}

function BlankBoard({ compact }: { compact: boolean }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#f4f4ef]"
      style={{
        backgroundImage: "radial-gradient(circle, rgba(23,23,23,0.13) 1px, transparent 1px)",
        backgroundSize: compact ? "6px 6px" : "14px 14px",
      }}
    >
      <svg
        viewBox="0 0 64 28"
        className={cn("text-muted-foreground", compact ? "w-6" : "w-16")}
        fill="none"
        stroke="currentColor"
        strokeWidth={compact ? 3 : 2}
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M4 18c6-10 11-10 14-2s8 8 12-1 9-10 13-1 8 7 17-4" />
        <path d="M10 24h40" strokeDasharray="2 5" />
      </svg>
      {!compact && (
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
          Blank board
        </span>
      )}
    </div>
  );
}
