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

/**
 * Frequence de reprise du bail une fois en lecture seule.
 *
 * Sans cette reprise, un projet ouvert pendant que le bail etait pris par
 * quelqu'un d'autre restait en lecture seule pour toujours, meme apres le
 * depart de l'autre membre : rien ne redemandait le bail, il fallait
 * recharger la page a la main pour retenter.
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
  /** Renseigne quand un autre membre tient le bail, pour l'afficher. */
  lockedBy: string | null;
  error: string | null;
  /**
   * Force une ecriture immediate, sans attendre le debounce. Rend `true` si
   * l'ecriture a reellement abouti — un appelant qui affiche "Enregistre"
   * sans le lire confirmerait une sauvegarde qui n'a pas eu lieu.
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
  /**
   * Le PATCH en vol, pour pouvoir l'annuler. Sans ca, un `saveNow` declenche
   * pendant qu'une ecriture debounced est deja partie faisait courir DEUX
   * requetes a la fois ; si la premiere (plus ancienne) revenait apres la
   * seconde, son etat ecrasait le plus recent sans que rien ne le remarque.
   */
  const inFlight = useRef<AbortController | null>(null);
  /** Incremente a chaque ecriture : une reponse perimee n'ecrit plus l'etat. */
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

      // Une ecriture plus recente est deja partie (ou revenue) entre-temps :
      // cette reponse ne represente plus l'etat courant, on ne l'applique pas.
      if (seq !== writeSeq.current) return false;

      if (response.status === 409) {
        // Un autre membre a pris la main : on cesse d'ecrire plutot que
        // d'ecraser son travail.
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
      // Un abort volontaire (write plus recent, ou demontage) n'est pas un
      // echec a signaler : la requete qui le remplace porte le vrai resultat.
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
  //
  // Le resultat compte : un renouvellement refuse (bail repris entre-temps)
  // laissait `writable` a `true` cote client sans que personne ne le sache
  // avant le PROCHAIN write — qui peut tarder si l'edition est calme. Le
  // bascule en lecture seule des ce renouvellement, pas au prochain essai
  // d'ecriture.
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
          // Un echec reseau ponctuel ne bascule pas en lecture seule : le
          // bail cote serveur tient encore LOCK_TTL_MS, le prochain
          // renouvellement peut reussir. Seul un refus explicite du serveur
          // (409, ou reponse non ok) signifie que le bail est vraiment perdu.
        });
    }, LOCK_RENEW_MS);

    return () => clearInterval(renew);
  }, [projectId]);

  // En lecture seule, retente periodiquement de reprendre le bail : sans
  // cela, un projet ouvert pendant qu'un autre membre editait restait bloque
  // meme apres son depart, jusqu'a un rechargement manuel de la page.
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
