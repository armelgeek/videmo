import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resolveActiveOrganization } from "@/lib/auth-organization";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import { prisma } from "@/lib/prisma";

const BILLING_MANAGER_ROLES = ["owner", "admin"];

export function canManageBilling(role: string | null | undefined): boolean {
  return !!role && BILLING_MANAGER_ROLES.includes(role);
}

export class BillingAccessError extends Error {
  constructor(readonly reason: "unauthenticated" | "forbidden") {
    super(reason === "unauthenticated" ? "Authentication required" : "Billing access denied");
    this.name = "BillingAccessError";
  }
}

export function billingAccessMessage(error: BillingAccessError): string {
  return error.reason === "unauthenticated"
    ? "Authentication required"
    : "Only organization owners and admins can manage billing";
}

export interface BillingViewer {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: string;
  canManage: boolean;
}

export async function getBillingViewer(): Promise<BillingViewer> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new BillingAccessError("unauthenticated");

  const organizationId = await resolveActiveOrganization(
    {
      id: session.session.id,
      userId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    },
    prismaOrganizationRepository,
  );

  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: session.user.id } },
    select: { role: true, organization: { select: { name: true } } },
  });
  if (!member) throw new BillingAccessError("forbidden");

  return {
    userId: session.user.id,
    email: session.user.email,
    organizationId,
    organizationName: member.organization.name,
    role: member.role,
    canManage: canManageBilling(member.role),
  };
}

export async function requireBillingManager(): Promise<BillingViewer> {
  const viewer = await getBillingViewer();
  if (!viewer.canManage) throw new BillingAccessError("forbidden");
  return viewer;
}
