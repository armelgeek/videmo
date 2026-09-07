"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOCK_TTL_MS } from "@/lib/video-project/lock";
import {
  fromLoadedProject,
  toProjectPatch,
  type ProjectSlice,
} from "./project-document";
import { useStoryboardStore } from "./store";

/**
 * Le bail expire au bout de LOCK_TTL_MS et le PATCH le REFUSE des qu'il est
 * perime : sans renouvellement, toute session d'edition plus longue que deux
 * minutes cesse silencieusement d'enregistrer. On renouvelle a la moitie du
 * bail pour qu'une requete perdue laisse une seconde chance avant l'expiration.
 */
const LOCK_RENEW_MS = LOCK_TTL_MS / 2;

/** Le temps de frappe laisse au titre avant d'ecrire. */
const SAVE_DEBOUNCE_MS = 1200;

export type SyncStatus =
  | "loading"
  | "saved"
  | "saving"
  | "read-only"
  | "error";

export interface ProjectSyncState {
  projectId: string | null;
  status: SyncStatus;
  /** Renseigne quand un autre membre tient le bail, pour l'afficher. */
  lockedBy: string | null;
  error: string | null;
  /** Force une ecriture immediate, sans attendre le debounce. */
  saveNow: () => Promise<void>;
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
 * Relie l'editeur a sa ligne en base.
 *
 * A l'ouverture : charge le projet designe par l'URL, ou en cree un et inscrit
 * son id dans l'URL — sans quoi un simple rechargement creerait un doublon.
 * Ensuite : prend le bail, le renouvelle, et ecrit chaque changement du store.
 */
export function useProjectSync(): ProjectSyncState {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // React 18 monte deux fois en developpement : sans ce garde, l'ouverture
  // creait deux projets.
  const bootstrapped = useRef(false);
  const projectIdRef = useRef<string | null>(null);
  const writable = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  const write = useCallback(async () => {
    const id = projectIdRef.current;
    if (!id || !writable.current) return;

    pending.current = false;
    setStatus("saving");
    try {
      const response = await fetch(`/api/video-projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toProjectPatch(readSlice())),
      });

      if (response.status === 409) {
        // Un autre membre a pris la main : on cesse d'ecrire plutot que
        // d'ecraser son travail.
        writable.current = false;
        const body = await response.json().catch(() => ({}));
        setLockedBy(body.lockedBy ?? null);
        setStatus("read-only");
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${response.status}`);
        setStatus("error");
        return;
      }

      setError(null);
      setStatus("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Network error");
      setStatus("error");
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
    await write();
  }, [write]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // Pas de drapeau d'annulation ici : le garde ci-dessus suffit a empecher le
    // second bootstrap du double-montage StrictMode. Un `cancelled` pose au
    // demontage simule abandonnait la SEULE course en vol — le store n'etait
    // jamais rempli et le statut restait "loading" indefiniment.
    const bootstrap = async () => {
      try {
        const url = new URL(window.location.href);
        let id = url.searchParams.get("project");

        if (id) {
          const response = await fetch(`/api/video-projects/${id}`);
          if (!response.ok) {
            setError(
              response.status === 404
                ? "Ce projet n'existe plus."
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
            setError(body.error ?? `HTTP ${response.status}`);
            setStatus("error");
            return;
          }
          const created = await response.json();
          id = created.id;
          // Remplace l'entree d'historique : un retour arriere ne doit pas
          // ramener sur une URL sans projet, qui en creerait un autre.
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

  // Renouvellement du bail pendant toute la duree de l'edition.
  useEffect(() => {
    if (!projectId) return;

    const renew = setInterval(() => {
      if (!writable.current) return;
      void fetch(`/api/video-projects/${projectId}/lock`, { method: "POST" });
    }, LOCK_RENEW_MS);

    return () => clearInterval(renew);
  }, [projectId]);

  // Ecrit a chaque changement du document, jamais sur l'etat d'ecran.
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

  // Rend la main en quittant, pour ne pas laisser le projet verrouille deux
  // minutes apres le depart. keepalive : la page peut disparaitre avant la fin.
  useEffect(() => {
    if (!projectId) return;

    const release = () => {
      if (!writable.current) return;
      // sendBeacon n'emet que des POST, verbe que la route n'expose pas :
      // keepalive est le seul moyen de finir un PATCH apres le depart.
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
