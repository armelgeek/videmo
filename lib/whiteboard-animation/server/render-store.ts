import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

/**
 * L'etat des rendus vit sur le DISQUE, a cote des videos.
 *
 * Un simple Map ne tient pas : Next recompile ses routes a chaud — le log
 * montre un `compile:` sur presque chaque requete — et chaque recompilation
 * remet l'etat du module a zero. Le job disparaissait alors en pleine
 * progression, avec un 404, pendant que sa video s'ecrivait sur le disque.
 * Observe deux fois en conditions reelles.
 *
 * Le Map reste comme cache et comme seul endroit ou vit la reference du process
 * enfant, qu'on ne peut pas serialiser.
 */
const jobs = new Map<string, Entree>();

const dossier = () =>
  process.env.RENDER_OUTPUT_DIR || join(process.cwd(), ".renders");

/**
 * Un id de job est un UUID, et rien d'autre.
 *
 * L'id arrive d'un segment d'URL et devient un CHEMIN de fichier. Sans ce
 * filtre, `../../quelque-chose` faisait lire un JSON hors du dossier des
 * rendus. Le seul producteur d'id etant randomUUID, restreindre a cette forme
 * ne coute rien.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cheminEtat = (id: string) => join(dossier(), `${id}.json`);

function ecrire(job: RenderJob): void {
  try {
    mkdirSync(dossier(), { recursive: true });
    writeFileSync(cheminEtat(job.id), JSON.stringify(job), "utf8");
  } catch {
    // Le disque peut refuser ; le cache memoire prend alors le relais tant que
    // le module vit. Perdre l'etat vaut mieux que perdre le rendu.
  }
}

function lire(id: string): RenderJob | undefined {
  try {
    const brut = JSON.parse(readFileSync(cheminEtat(id), "utf8"));
    if (!brut || typeof brut.id !== "string" || typeof brut.userId !== "string") {
      return undefined;
    }
    return { ...brut, createdAt: new Date(brut.createdAt) } as RenderJob;
  } catch {
    return undefined;
  }
}

/** Vide le cache memoire. Sert aux tests a simuler une recompilation. */
export function oublierJobsEnMemoire(): void {
  jobs.clear();
}

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
  ecrire(job);
  return job;
}

/** Le job, depuis le cache ou depuis le disque. Sans controle de proprietaire. */
function charger(id: string): Entree | undefined {
  if (!UUID.test(id)) return undefined;
  const e = jobs.get(id);
  if (e) return e;
  const job = lire(id);
  if (!job) return undefined;
  const rehydrate: Entree = { job, child: null };
  jobs.set(id, rehydrate);
  return rehydrate;
}

export function getRenderJob(id: string, userId: string): RenderJob | undefined {
  const e = charger(id);
  // Le job d'un autre est traite comme inexistant : distinguer les deux
  // confirmerait son existence.
  return e && e.job.userId === userId ? e.job : undefined;
}

export function attachChild(id: string, child: { kill: () => void }): void {
  const e = charger(id);
  if (e) e.child = child;
}

export function updateRenderJob(id: string, patch: Partial<RenderJob>): void {
  const e = charger(id);
  if (!e) return;
  Object.assign(e.job, patch);
  ecrire(e.job);
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
  const e = charger(id);
  if (!e || TERMINAUX.has(e.job.status)) return;
  Object.assign(e.job, patch);
  ecrire(e.job);
}

export function cancelRenderJob(id: string, userId: string): boolean {
  const e = charger(id);
  if (!e || e.job.userId !== userId) return false;
  // Un rendu deja conclu ne s'annule plus. Sans cette garde, un clic sur
  // « Annuler » pendant la derniere seconde faisait passer un job 'done' a
  // 'cancelled' : la video etait bien sur le disque, mais la route de
  // telechargement, qui exige 'done', repondait 404. L'utilisateur perdait un
  // rendu abouti.
  if (TERMINAUX.has(e.job.status)) return false;
  // Le process n'est connu que du module qui l'a lance : apres une
  // recompilation il est hors de portee, mais l'etat reste juste.
  e.child?.kill();
  e.job.status = "cancelled";
  ecrire(e.job);
  return true;
}
