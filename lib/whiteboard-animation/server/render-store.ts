import { randomUUID } from "node:crypto";

export type RenderStatus = "pending" | "rendering" | "done" | "error" | "cancelled";

export interface RenderJob {
  id: string;
  userId: string;
  /** The project exported, so its video can be offered from the project list. */
  projectId: string | null;
  status: RenderStatus;
  progress: number;
  /** Cle de la video dans le bac, une fois envoyee. */
  outputKey: string | null;
  error: string | null;
  createdAt: Date;
}

export type RenderPatch = Partial<Pick<RenderJob, "status" | "progress" | "outputKey" | "error">>;

/** Pourquoi une place est refusee : l'utilisateur a deja un rendu, ou le parc est plein. */
export type Refusal = "user" | "global";

const ACTIVE: RenderStatus[] = ["pending", "rendering"];
const isActive = (status: RenderStatus) => ACTIVE.includes(status);

/**
 * Sans signal de vie depuis ce delai, l'instance qui rendait est tenue pour
 * morte : son job passe en erreur et libere sa place. La route emet un signal
 * toutes les 30 s, meme quand une frame lente retient la progression.
 */
export const STALE_AFTER_MS = 2 * 60 * 1000;
export const STALE_ERROR = "Rendu interrompu : le serveur qui le produisait s'est arrete";

/**
 * Un id de job est un UUID, et rien d'autre : il arrive d'un segment d'URL.
 * Le seul producteur d'id etant randomUUID, restreindre a cette forme ne coute
 * rien.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cle du verrou Postgres qui serialise les reservations de toutes les instances. */
const RENDER_LOCK_KEY = 72_406_001;

export interface RenderJobBackend {
  /** Reserve une place et cree le job, ou dit pourquoi c'est refuse. Atomique. */
  createIfCapacity(input: {
    id: string;
    userId: string;
    projectId?: string | null;
    perUser: number;
    global: number;
    now: Date;
  }): Promise<RenderJob | Refusal>;
  get(id: string): Promise<RenderJob | undefined>;
  /** Signal de vie, progression facultative. false si le job n'est plus actif. */
  touch(id: string, progress: number | null, now: Date): Promise<boolean>;
  /** Conclut un job actif ; une conclusion deja prise n'est jamais defaite. */
  finalize(id: string, patch: RenderPatch): Promise<boolean>;
  cancel(id: string, userId: string): Promise<boolean>;
  /** Retire et rend les jobs conclus crees avant `before`. */
  takeExpired(before: Date): Promise<RenderJob[]>;
}

type Row = RenderJob & { heartbeatAt: Date };
const strip = ({ heartbeatAt: _h, ...job }: Row): RenderJob => ({ ...job });

export class InMemoryRenderJobBackend implements RenderJobBackend {
  readonly rows = new Map<string, Row>();

  private reapStale(now: Date) {
    for (const row of this.rows.values()) {
      if (isActive(row.status) && now.getTime() - row.heartbeatAt.getTime() > STALE_AFTER_MS) {
        row.status = "error";
        row.error = STALE_ERROR;
      }
    }
  }

  async createIfCapacity({ id, userId, projectId = null, perUser, global, now }: Parameters<RenderJobBackend["createIfCapacity"]>[0]) {
    this.reapStale(now);
    const active = [...this.rows.values()].filter((r) => isActive(r.status));
    if (active.filter((r) => r.userId === userId).length >= perUser) return "user" as const;
    if (active.length >= global) return "global" as const;
    const row: Row = {
      id,
      userId,
      projectId,
      status: "rendering",
      progress: 0,
      outputKey: null,
      error: null,
      createdAt: now,
      heartbeatAt: now,
    };
    this.rows.set(id, row);
    return strip(row);
  }

  async get(id: string) {
    const row = this.rows.get(id);
    return row ? strip(row) : undefined;
  }

  async touch(id: string, progress: number | null, now: Date) {
    const row = this.rows.get(id);
    if (!row || !isActive(row.status)) return false;
    if (progress !== null) row.progress = progress;
    row.heartbeatAt = now;
    return true;
  }

  async finalize(id: string, patch: RenderPatch) {
    const row = this.rows.get(id);
    if (!row || !isActive(row.status)) return false;
    Object.assign(row, patch);
    return true;
  }

  async cancel(id: string, userId: string) {
    const row = this.rows.get(id);
    if (!row || row.userId !== userId || !isActive(row.status)) return false;
    row.status = "cancelled";
    return true;
  }

  async takeExpired(before: Date) {
    const expired: RenderJob[] = [];
    for (const row of [...this.rows.values()]) {
      if (!isActive(row.status) && row.createdAt < before) {
        this.rows.delete(row.id);
        expired.push(strip(row));
      }
    }
    return expired;
  }
}

type PrismaRenderRow = {
  id: string;
  userId: string;
  projectId: string | null;
  status: string;
  progress: number;
  outputKey: string | null;
  error: string | null;
  createdAt: Date;
};

const toJob = (row: PrismaRenderRow): RenderJob => ({
  id: row.id,
  userId: row.userId,
  projectId: row.projectId,
  status: row.status as RenderStatus,
  progress: row.progress,
  outputKey: row.outputKey,
  error: row.error,
  createdAt: row.createdAt,
});

const db = async () => (await import("@/lib/prisma")).prisma;

export class PrismaRenderJobBackend implements RenderJobBackend {
  async createIfCapacity({ id, userId, projectId = null, perUser, global, now }: Parameters<RenderJobBackend["createIfCapacity"]>[0]) {
    const prisma = await db();
    return prisma.$transaction(async (tx) => {
      // Le verrou serialise les reservations de TOUTES les instances : sans
      // lui, deux exports simultanes comptaient la meme place libre.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RENDER_LOCK_KEY}::bigint)`;
      await tx.renderJob.updateMany({
        where: {
          status: { in: ACTIVE },
          heartbeatAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) },
        },
        data: { status: "error", error: STALE_ERROR },
      });
      const mine = await tx.renderJob.count({ where: { userId, status: { in: ACTIVE } } });
      if (mine >= perUser) return "user" as const;
      const all = await tx.renderJob.count({ where: { status: { in: ACTIVE } } });
      if (all >= global) return "global" as const;
      const row = await tx.renderJob.create({
        data: { id, userId, projectId, status: "rendering", heartbeatAt: now, createdAt: now },
      });
      return toJob(row);
    });
  }

  async get(id: string) {
    const row = await (await db()).renderJob.findUnique({ where: { id } });
    return row ? toJob(row) : undefined;
  }

  async touch(id: string, progress: number | null, now: Date) {
    const { count } = await (await db()).renderJob.updateMany({
      where: { id, status: { in: ACTIVE } },
      data: { heartbeatAt: now, ...(progress !== null ? { progress } : {}) },
    });
    return count > 0;
  }

  async finalize(id: string, patch: RenderPatch) {
    const { count } = await (await db()).renderJob.updateMany({
      where: { id, status: { in: ACTIVE } },
      data: patch,
    });
    return count > 0;
  }

  async cancel(id: string, userId: string) {
    const { count } = await (await db()).renderJob.updateMany({
      where: { id, userId, status: { in: ACTIVE } },
      data: { status: "cancelled" },
    });
    return count > 0;
  }

  async takeExpired(before: Date) {
    const prisma = await db();
    const rows = await prisma.renderJob.findMany({
      where: { status: { notIn: ACTIVE }, createdAt: { lt: before } },
      take: 100,
    });
    if (rows.length > 0) {
      await prisma.renderJob.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    }
    return rows.map(toJob);
  }
}

let backend: RenderJobBackend = new PrismaRenderJobBackend();

/** Les tests passent le backend en memoire. */
export function setRenderJobBackend(next: RenderJobBackend): void {
  backend = next;
}

/**
 * Les process enfants de CETTE instance. Un process ne se serialise pas : il
 * reste ici, et une annulation recue ailleurs l'atteint au prochain signal de
 * vie, qui trouve le job inactif.
 */
const children = new Map<string, { kill: () => void }>();

/** Oublie les process connus. Sert aux tests a simuler une autre instance. */
export function forgetLocalChildren(): void {
  children.clear();
}

export async function reserveRenderJob(
  userId: string,
  limits: { perUser: number; global: number; perInstance: number },
  projectId: string | null = null,
): Promise<RenderJob | Refusal> {
  // Chaque rendu occupe un coeur de CETTE machine, quel que soit le parc.
  if (children.size >= limits.perInstance) return "global";
  return backend.createIfCapacity({
    id: randomUUID(),
    userId,
    projectId,
    perUser: limits.perUser,
    global: limits.global,
    now: new Date(),
  });
}

export async function getRenderJob(id: string, userId: string): Promise<RenderJob | undefined> {
  if (!UUID.test(id)) return undefined;
  const job = await backend.get(id);
  // Le job d'un autre est traite comme inexistant : distinguer les deux
  // confirmerait son existence.
  return job && job.userId === userId ? job : undefined;
}

export function attachChild(id: string, child: { kill: () => void }): void {
  children.set(id, child);
}

/**
 * Signal de vie et progression. Rend false si le job n'est plus actif — annule,
 * y compris depuis une autre instance — et tue alors le process local.
 */
export async function reportRenderProgress(id: string, progress: number | null): Promise<boolean> {
  const active = await backend.touch(id, progress, new Date());
  if (!active) {
    children.get(id)?.kill();
    children.delete(id);
  }
  return active;
}

export async function finalizeRenderJob(id: string, patch: RenderPatch): Promise<boolean> {
  children.delete(id);
  return backend.finalize(id, patch);
}

export async function cancelRenderJob(id: string, userId: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  // Un rendu deja conclu ne s'annule plus : sa video reste telechargeable.
  const cancelled = await backend.cancel(id, userId);
  if (cancelled) {
    children.get(id)?.kill();
    children.delete(id);
  }
  return cancelled;
}

export async function takeExpiredRenders(maxAgeMs: number, now = Date.now()): Promise<RenderJob[]> {
  return backend.takeExpired(new Date(now - maxAgeMs));
}
