export interface OrganizationMembership {
  organizationId: string;
  joinedAt: Date;
}

/**
 * The active organization at sign-in: the most recently joined one.
 *
 * Sorts a COPY: this runs from a session hook that passes in the list it has
 * just read.
 */
export function chooseActiveOrganization(
  memberships: OrganizationMembership[],
): string | null {
  if (memberships.length === 0) return null;

  const [mostRecent] = [...memberships].sort(
    (a, b) => b.joinedAt.getTime() - a.joinedAt.getTime(),
  );
  return mostRecent.organizationId;
}

export interface OrganizationRepository {
  listMemberships(userId: string): Promise<OrganizationMembership[]>;
  writeActiveOrganization(sessionId: string, organizationId: string): Promise<void>;
}

/**
 * A session's active organization, resolved on demand when it is missing.
 *
 * The migration adds activeOrganizationId as NULL on already-open sessions.
 * Resolving them here avoids having to sign everyone out.
 */
export async function resolveActiveOrganization(
  session: { id: string; userId: string; activeOrganizationId: string | null },
  repository: OrganizationRepository,
): Promise<string | null> {
  if (session.activeOrganizationId) return session.activeOrganizationId;

  const memberships = await repository.listMemberships(session.userId);
  const chosen = chooseActiveOrganization(memberships);
  if (!chosen) return null;

  await repository.writeActiveOrganization(session.id, chosen);
  return chosen;
}
