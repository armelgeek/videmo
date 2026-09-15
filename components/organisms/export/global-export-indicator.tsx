"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Download, Loader2, X } from "lucide-react";

export const RENDER_STORAGE_PREFIX = "sketchpilot:render:";
export const RENDER_CHANGED_EVENT = "sketchpilot:render-changed";

type Tracked = {
  projectId: string;
  jobId: string;
  title: string;
  progress: number;
  status: "rendering" | "done";
};

/** Stored as JSON {jobId,title}; older entries are the bare job id. */
export function parseStoredRender(raw: string | null): { jobId: string; title: string } | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { jobId?: string; title?: string };
    if (value?.jobId) return { jobId: value.jobId, title: value.title ?? "" };
  } catch {}
  return { jobId: raw, title: "" };
}

function readStored(): { projectId: string; jobId: string; title: string }[] {
  const found: { projectId: string; jobId: string; title: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(RENDER_STORAGE_PREFIX)) continue;
      const parsed = parseStoredRender(localStorage.getItem(key));
      if (parsed) found.push({ projectId: key.slice(RENDER_STORAGE_PREFIX.length), ...parsed });
    }
  } catch {}
  return found;
}

function forget(projectId: string) {
  try {
    localStorage.removeItem(`${RENDER_STORAGE_PREFIX}${projectId}`);
  } catch {}
}

/**
 * Follows exports started from the editor on every other page. The editor
 * shows its own card, so this stays out of the way there.
 */
export function GlobalExportIndicator() {
  const pathname = usePathname();
  const [tracked, setTracked] = useState<Tracked[]>([]);

  const sync = useCallback(() => {
    const stored = readStored();
    setTracked((current) =>
      stored.map((s) => {
        const known = current.find((t) => t.jobId === s.jobId);
        return known ?? { ...s, progress: 0, status: "rendering" };
      }),
    );
  }, []);

  useEffect(() => {
    // localStorage only exists in the browser: read it after mount, not during render.
    const initial = setTimeout(sync, 0);
    window.addEventListener("storage", sync);
    window.addEventListener(RENDER_CHANGED_EVENT, sync);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("storage", sync);
      window.removeEventListener(RENDER_CHANGED_EVENT, sync);
    };
  }, [sync]);

  const onEditor = pathname?.startsWith("/storyboard") ?? false;
  const rendering = tracked.filter((t) => t.status === "rendering").map((t) => t.jobId).join(",");

  useEffect(() => {
    if (onEditor || !rendering) return;
    let active = true;
    const poll = async () => {
      for (const jobId of rendering.split(",")) {
        try {
          const res = await fetch(`/api/whiteboard/render/${jobId}`);
          const body = res.ok ? await res.json() : null;
          if (!active) return;
          setTracked((current) =>
            current.flatMap((t) => {
              if (t.jobId !== jobId) return [t];
              if (!body || body.status === "error" || body.status === "cancelled") {
                forget(t.projectId);
                return [];
              }
              if (body.status === "done") {
                // The editor would otherwise resume a job that is already finished.
                forget(t.projectId);
                return [{ ...t, status: "done" as const, progress: 100 }];
              }
              return [{ ...t, progress: body.progress ?? t.progress }];
            }),
          );
        } catch {}
      }
    };
    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [onEditor, rendering]);

  if (onEditor || tracked.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 z-50 flex w-72 flex-col gap-2">
      {tracked.map((t) => (
        <div
          key={t.jobId}
          role="status"
          className="flex flex-col gap-2 rounded-lg border-2 border-ink bg-card px-3 py-2.5 shadow-[3px_3px_0_hsl(var(--offset))]"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
            <span className="flex min-w-0 items-center gap-2">
              {t.status === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              )}
              <span className="truncate">
                {t.status === "done" ? "Video ready" : "Exporting"}
                {t.title && ` · ${t.title}`}
              </span>
            </span>
            {t.status === "done" ? (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setTracked((c) => c.filter((x) => x.jobId !== t.jobId))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="tabular-nums text-muted-foreground">{Math.round(t.progress)}%</span>
            )}
          </div>

          {t.status === "done" ? (
            <a
              href={`/api/whiteboard/render/${t.jobId}/file`}
              download
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border-2 border-ink bg-highlight text-xs font-semibold text-highlight-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              Download MP4
            </a>
          ) : (
            <>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-highlight transition-[width] duration-500"
                  style={{ width: `${t.progress}%` }}
                />
              </span>
              <Link
                href={`/storyboard?project=${t.projectId}`}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Open project
              </Link>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
