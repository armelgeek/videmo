"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showBillingNotice } from "@/lib/billing/show-billing-notice";
import { LOCK_TTL_MS } from "@/lib/video-project/lock";
import {
  fromLoadedProject,
  toProjectPatch,
  type ProjectSlice,
} from "./project-document";
import { useStoryboardStore } from "./store";

/**
 * The lease expires after LOCK_TTL_MS and the PATCH REJECTS it as soon as it is
 * stale: without renewal, any editing session longer than two
 * minutes silently stops saving. We renew at half the
 * lease so a lost request leaves a second chance before expiry.
 */
const LOCK_RENEW_MS = LOCK_TTL_MS / 2;

/** The typing time given to the title before writing. */
const SAVE_DEBOUNCE_MS = 1200;

/**
 * How often to retry taking the lease while read-only.
 *
 * Without this retry, a project opened while the lease was held by
 * someone else stayed read-only forever, even after the other member
 * left: nothing asked for the lease again, the page had to be
 * reloaded by hand to retry.
 */
const LOCK_RETRY_MS = 15_000;

export type SyncStatus =
  | "loading"
  | "saved"
  | "saving"
  | "read-only"
  | "error";

export interface ProjectSyncState {
  projectId: string | null;
  status: SyncStatus;
  /** Set when another member holds the lease, to display it. */
  lockedBy: string | null;
  error: string | null;
  /**
   * Forces an immediate write, without waiting for the debounce. Returns `true` if
   * the write actually succeeded — a caller that shows "Saved"
   * without reading it would confirm a save that never happened.
   */
  saveNow: () => Promise<boolean>;
}

const PROJECT_FIELDS = [
  "step",
  "projectTitle",
  "promptContent",
  "projectParams",
  "scriptTitle",
  "scriptText",
  "storyboardPanels",
  "selectedVoice",
  "whiteboardConfig",
] as const;

function readSlice(): ProjectSlice {
  const state = useStoryboardStore.getState();
  return Object.fromEntries(
    PROJECT_FIELDS.map((key) => [key, state[key]]),
  ) as unknown as ProjectSlice;
}

/**
 * Binds the editor to its database row.
 *
 * On open: loads the project named by the URL, or creates one and writes
 * its id into the URL — otherwise a simple reload would create a duplicate.
 * Then: takes the lease, renews it, and writes every store change.
 */
export function useProjectSync(): ProjectSyncState {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // React 18 mounts twice in development: without this guard, opening
  // created two projects.
  const bootstrapped = useRef(false);
  const projectIdRef = useRef<string | null>(null);
  const writable = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  /**
   * The in-flight PATCH, so it can be aborted. Without it, a `saveNow` triggered
   * while a debounced write had already gone out ran TWO
   * requests at once; if the first (older) one came back after the
   * second, its state overwrote the newer one without anyone noticing.
   */
  const inFlight = useRef<AbortController | null>(null);
  /** Incremented on each write: a stale response no longer writes the state. */
  const writeSeq = useRef(0);

  const write = useCallback(async (): Promise<boolean> => {
    const id = projectIdRef.current;
    if (!id || !writable.current) return false;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const seq = ++writeSeq.current;

    pending.current = false;
    setStatus("saving");
    try {
      const response = await fetch(`/api/video-projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toProjectPatch(readSlice())),
        signal: controller.signal,
      });

      // A newer write has already gone out (or come back) in the meantime:
      // this response no longer reflects the current state, so we don't apply it.
      if (seq !== writeSeq.current) return false;

      if (response.status === 409) {
        // Another member took over: we stop writing rather than
        // overwrite their work.
        writable.current = false;
        const body = await response.json().catch(() => ({}));
        setLockedBy(body.lockedBy ?? null);
        setStatus("read-only");
        return false;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${response.status}`);
        setStatus("error");
        return false;
      }

      setError(null);
      setStatus("saved");
      return true;
    } catch (cause) {
      // A deliberate abort (newer write, or unmount) is not a
      // failure to report: the request replacing it carries the real result.
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return false;
      }
      if (seq !== writeSeq.current) return false;
      setError(cause instanceof Error ? cause.message : "Network error");
      setStatus("error");
      return false;
    }
  }, []);

  const scheduleWrite = useCallback(() => {
    if (!writable.current) return;
    pending.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void write(), SAVE_DEBOUNCE_MS);
  }, [write]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    return write();
  }, [write]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // No cancellation flag here: the guard above is enough to prevent the
    // second bootstrap of the StrictMode double mount. A `cancelled` set on the
    // simulated unmount abandoned the ONLY in-flight run — the store was
    // never filled and the status stayed "loading" forever.
    const bootstrap = async () => {
      try {
        const url = new URL(window.location.href);
        let id = url.searchParams.get("project");

        if (id) {
          const response = await fetch(`/api/video-projects/${id}`);
          if (!response.ok) {
            setError(
              response.status === 404
                ? "This project no longer exists."
                : `HTTP ${response.status}`,
            );
            setStatus("error");
            return;
          }
          const project = await response.json();
          projectIdRef.current = id;
          useStoryboardStore.setState(fromLoadedProject(project));
        } else {
          const response = await fetch("/api/video-projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: useStoryboardStore.getState().projectTitle,
            }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            showBillingNotice(response.status, body);
            setError(body.error ?? `HTTP ${response.status}`);
            setStatus("error");
            return;
          }
          const created = await response.json();
          id = created.id;
          // Replace the history entry: going back must not
          // land on a URL without a project, which would create another one.
          url.searchParams.set("project", id as string);
          window.history.replaceState(null, "", url);
          projectIdRef.current = id;
        }

        setProjectId(id);

        const lock = await fetch(`/api/video-projects/${id}/lock`, {
          method: "POST",
        });

        if (lock.status === 409) {
          const body = await lock.json().catch(() => ({}));
          setLockedBy(body.lockedBy ?? null);
          setStatus("read-only");
          return;
        }

        writable.current = lock.ok;
        setStatus(lock.ok ? "saved" : "read-only");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Network error");
        setStatus("error");
      }
    };

    void bootstrap();
  }, []);

  // Lease renewal for the whole editing session.
  //
  // The result matters: a rejected renewal (lease taken over in the meantime)
  // left `writable` at `true` on the client without anyone knowing
  // until the NEXT write — which may be a while if editing is quiet. This
  // switches to read-only on this renewal, not on the next write
  // attempt.
  useEffect(() => {
    if (!projectId) return;

    const renew = setInterval(() => {
      if (!writable.current) return;
      void fetch(`/api/video-projects/${projectId}/lock`, { method: "POST" })
        .then(async (response) => {
          if (response.ok) return;
          writable.current = false;
          if (response.status === 409) {
            const body = await response.json().catch(() => ({}));
            setLockedBy(body.lockedBy ?? null);
          }
          setStatus("read-only");
        })
        .catch(() => {
          // A one-off network failure does not switch to read-only: the
          // server-side lease still holds for LOCK_TTL_MS, the next
          // renewal may succeed. Only an explicit server refusal
          // (409, or non-ok response) means the lease is really lost.
        });
    }, LOCK_RENEW_MS);

    return () => clearInterval(renew);
  }, [projectId]);

  // While read-only, periodically retry taking the lease: without
  // this, a project opened while another member was editing stayed blocked
  // even after they left, until a manual page reload.
  useEffect(() => {
    if (!projectId || status !== "read-only") return;

    const retry = setInterval(() => {
      void fetch(`/api/video-projects/${projectId}/lock`, { method: "POST" })
        .then(async (response) => {
          if (!response.ok) return;
          writable.current = true;
          setLockedBy(null);
          setError(null);
          setStatus("saved");
        })
        .catch(() => {});
    }, LOCK_RETRY_MS);

    return () => clearInterval(retry);
  }, [projectId, status]);

  // Write on every document change, never on screen state.
  useEffect(() => {
    if (!projectId) return;

    let previous = readSlice();
    return useStoryboardStore.subscribe((state) => {
      const changed = PROJECT_FIELDS.some(
        (key) => (state as never)[key] !== (previous as never)[key],
      );
      if (!changed) return;
      previous = readSlice();
      scheduleWrite();
    });
  }, [projectId, scheduleWrite]);

  // Release the lock when leaving, so the project isn't left locked two
  // minutes after departure. keepalive: the page may disappear before completion.
  useEffect(() => {
    if (!projectId) return;

    const release = () => {
      if (!writable.current) return;
      // sendBeacon only sends POSTs, a verb the route does not expose:
      // keepalive is the only way to finish a PATCH after leaving.
      if (pending.current) {
        void fetch(`/api/video-projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toProjectPatch(readSlice())),
          keepalive: true,
        });
      }
      void fetch(`/api/video-projects/${projectId}/lock`, {
        method: "DELETE",
        keepalive: true,
      });
    };

    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [projectId]);

  return { projectId, status, lockedBy, error, saveNow };
}
