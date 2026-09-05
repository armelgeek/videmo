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
};
