export const LOCK_TTL_MS = 120_000;

export type LockState = "free" | "held-by-me" | "held-by-other";

export interface LockableProject {
  lockedById: string | null;
  lockExpiresAt: Date | null;
}

/**
 * L'expiration est une lecture, jamais une écriture : un bail périmé se lit
 * comme libre, donc aucune tâche de nettoyage n'est nécessaire.
 */
export function lockState(
  project: LockableProject,
  userId: string,
  now: Date,
): LockState {
  const { lockedById, lockExpiresAt } = project;
  if (!lockedById || !lockExpiresAt) return "free";
  if (lockExpiresAt.getTime() <= now.getTime()) return "free";
  return lockedById === userId ? "held-by-me" : "held-by-other";
}

export function acquireLock(
  project: LockableProject,
  userId: string,
  now: Date,
): { lockedById: string; lockExpiresAt: Date } | null {
  if (lockState(project, userId, now) === "held-by-other") return null;
  return {
    lockedById: userId,
    lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS),
  };
}

export function releaseLock(
  project: LockableProject,
  userId: string,
): { lockedById: null; lockExpiresAt: null } | null {
  if (project.lockedById !== userId) return null;
  return { lockedById: null, lockExpiresAt: null };
}
