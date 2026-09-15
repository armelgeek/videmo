import { prisma } from "@/lib/prisma";
import { UNLIMITED } from "./catalog";
import { QuotaExceededError } from "./errors";
import { getOrgPlan } from "./plan-gating";

export function countActiveProjects(organizationId: string): Promise<number> {
  return prisma.videoProject.count({ where: { organizationId, deletedAt: null } });
}

// Pending invitations hold a seat, otherwise a full org could invite past its limit.
export async function countSeats(organizationId: string): Promise<number> {
  const [members, pending] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId } }),
    prisma.organizationInvitation.count({
      where: { organizationId, status: "pending", expiresAt: { gt: new Date() } },
    }),
  ]);
  return members + pending;
}

export async function assertProjectQuota(organizationId: string): Promise<void> {
  const plan = await getOrgPlan(organizationId);
  const limit = plan.quotas.max_projects ?? 0;
  if (limit === UNLIMITED) return;
  const current = await countActiveProjects(organizationId);
  if (current >= limit) throw new QuotaExceededError("max_projects", limit, current);
}

export async function assertSeatAvailable(organizationId: string): Promise<void> {
  const plan = await getOrgPlan(organizationId);
  const limit = plan.quotas.max_org_members ?? 1;
  if (limit === UNLIMITED) return;
  const current = await countSeats(organizationId);
  if (current >= limit) throw new QuotaExceededError("max_org_members", limit, current);
}

export async function membershipLimitFor(organizationId: string): Promise<number> {
  const plan = await getOrgPlan(organizationId);
  const limit = plan.quotas.max_org_members ?? 1;
  return limit === UNLIMITED ? Number.MAX_SAFE_INTEGER : limit;
}

// Export resolution is a ceiling, not a count: exporting exactly the limit is allowed.
export async function assertExportResolution(
  organizationId: string,
  requestedShortSide: number,
): Promise<void> {
  const plan = await getOrgPlan(organizationId);
  const limit = plan.quotas.max_export_resolution ?? 0;
  if (limit !== UNLIMITED && requestedShortSide > limit) {
    throw new QuotaExceededError("max_export_resolution", limit, requestedShortSide);
  }
}
