export interface RenameDeps {
  takeLock(projectId: string): Promise<{ ok: boolean }>;
  patchTitle(projectId: string, title: string): Promise<{ ok: boolean; error?: string }>;
  releaseLock(projectId: string): Promise<unknown>;
}

export async function renameWithLock(
  projectId: string,
  title: string,
  deps: RenameDeps,
): Promise<void> {
  const taken = await deps.takeLock(projectId);
  if (!taken.ok) throw new Error("Projet en cours d'édition par un autre membre");

  try {
    const res = await deps.patchTitle(projectId, title);
    if (!res.ok) throw new Error(res.error);
  } finally {
    // A failed release must not hide the reason for the failure: the lease
    // expires on its own, the PATCH error is the only one useful to the caller.
    try {
      await deps.releaseLock(projectId);
    } catch (error) {
      // Logged, not rethrown: without this line, a lease held until its
      // expiry would have no explanation anywhere.
      console.warn("releaseLock failed", { projectId, error });
    }
  }
}
