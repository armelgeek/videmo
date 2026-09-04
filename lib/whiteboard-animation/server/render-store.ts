import { randomUUID } from "node:crypto";

export interface RenderJob {
  id: string;
  userId: string;
  status: "pending" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  outputPath: string | null;
  error: string | null;
  createdAt: Date;
}

interface Entree {
  job: RenderJob;
  child: { kill: () => void } | null;
}

// En memoire : un redemarrage perd les rendus en cours. Acceptable pour le MVP,
// et deja le cas du store de generation existant.
const jobs = new Map<string, Entree>();

export function createRenderJob(userId: string): RenderJob {
  // randomUUID et non un compteur : l'id voyage dans une URL de telechargement,
  // il ne doit pas etre devinable.
  const job: RenderJob = {
    id: randomUUID(),
    userId,
    status: "pending",
    progress: 0,
    outputPath: null,
    error: null,
    createdAt: new Date(),
  };
  jobs.set(job.id, { job, child: null });
  return job;
}

export function getRenderJob(id: string, userId: string): RenderJob | undefined {
  const e = jobs.get(id);
  // Le job d'un autre est traite comme inexistant : distinguer les deux
  // confirmerait son existence.
  return e && e.job.userId === userId ? e.job : undefined;
}

export function attachChild(id: string, child: { kill: () => void }): void {
  const e = jobs.get(id);
  if (e) e.child = child;
}

export function updateRenderJob(id: string, patch: Partial<RenderJob>): void {
  const e = jobs.get(id);
  if (e) Object.assign(e.job, patch);
}

/** Un job qui a atteint l'un de ces etats n'en bouge plus. */
const TERMINAUX = new Set(["done", "error", "cancelled"]);

/**
 * Conclut un job, sans jamais revenir sur une conclusion deja prise.
 *
 * La sortie du process arrive APRES l'annulation : sans cette garde, un arret
 * volontaire se reafficherait en erreur. Et un 'done' deja recu ne doit pas
 * etre defait par le code de sortie qui le suit.
 */
export function finalizeRenderJob(id: string, patch: Partial<RenderJob>): void {
  const e = jobs.get(id);
  if (!e || TERMINAUX.has(e.job.status)) return;
  Object.assign(e.job, patch);
}

export function cancelRenderJob(id: string, userId: string): boolean {
  const e = jobs.get(id);
  if (!e || e.job.userId !== userId) return false;
  e.child?.kill();
  e.job.status = "cancelled";
  return true;
}
