import { prisma } from "./prisma";
import type { DepotOrganisation } from "./auth-organisation";

export const depotOrganisationPrisma: DepotOrganisation = {
  listerAppartenances: (userId) =>
    prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true, joinedAt: true },
    }),

  ecrireOrganisationActive: async (sessionId, organizationId) => {
    await prisma.session.update({
      where: { id: sessionId },
      data: { activeOrganizationId: organizationId },
    });
  },
};
