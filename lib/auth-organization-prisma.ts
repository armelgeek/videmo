import { prisma } from "./prisma";
import type { OrganizationRepository } from "./auth-organization";

export const prismaOrganizationRepository: OrganizationRepository = {
  listMemberships: (userId) =>
    prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true, joinedAt: true },
    }),

  writeActiveOrganization: async (sessionId, organizationId) => {
    await prisma.session.update({
      where: { id: sessionId },
      data: { activeOrganizationId: organizationId },
    });
  },

  // The slug is derived from the user id so the unique index turns a
  // concurrent second call into a no-op instead of a duplicate organization.
  ensurePersonalOrganization: async (userId) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const slug = `personal-${userId}`;
    const name = `${user.name || user.email.split("@")[0]}'s workspace`;

    const organization = await prisma.organization.upsert({
      where: { slug },
      create: { slug, name },
      update: {},
      select: { id: true },
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId } },
      create: { organizationId: organization.id, userId, role: "owner" },
      update: {},
    });
    return organization.id;
  },
};
