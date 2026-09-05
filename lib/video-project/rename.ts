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
    await deps.releaseLock(projectId);
  }
}
