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
  /** Must be idempotent: two first requests of a new user race to call it. */
  ensurePersonalOrganization(userId: string): Promise<string>;
}

/**
 * A session's active organization, resolved on demand when it is missing.
 *
 * Every project belongs to an organization: a user without one gets a personal
 * organization rather than a dead end on every project route.
 */
export async function resolveActiveOrganization(
  session: { id: string; userId: string; activeOrganizationId: string | null },
  repository: OrganizationRepository,
): Promise<string> {
  if (session.activeOrganizationId) return session.activeOrganizationId;

  const memberships = await repository.listMemberships(session.userId);
  const chosen =
    chooseActiveOrganization(memberships) ??
    (await repository.ensurePersonalOrganization(session.userId));

  await repository.writeActiveOrganization(session.id, chosen);
  return chosen;
}
