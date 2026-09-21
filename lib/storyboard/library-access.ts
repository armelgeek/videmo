import { db as prisma } from "@/lib/db";

/**
 * Formats and styles are shared: one row is what every project in the
 * organization generates against, and saving under a shipped key overrides it
 * for everyone. So curating the library is an admin act, not a member one —
 * the same rule billing already follows.
 */
const CURATOR_ROLES = ["owner", "admin"];

export function canCurateLibrary(role: string | null | undefined): boolean {
  return !!role && CURATOR_ROLES.includes(role);
}

export const LIBRARY_FORBIDDEN = "Only organization owners and admins can change formats and styles";

/** Whether this member may write the organization's formats and styles. */
export async function viewerCanCurate(
  organizationId: string | null,
  userId: string,
): Promise<boolean> {
  if (!organizationId) return false;

  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });

  return canCurateLibrary(member?.role);
}
