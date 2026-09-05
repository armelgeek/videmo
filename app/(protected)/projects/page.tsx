import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { resolveActiveOrganization } from "@/lib/auth-organization";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import { canAct } from "@/lib/video-project/access";
import { VideoProjectList } from "@/components/organisms/video-project-list";

export default async function ProjectsPage() {
  const session = await requireAuth();

  const organizationId = await resolveActiveOrganization(
    {
      id: session.session.id,
      userId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    },
    prismaOrganizationRepository,
  );

  const member = organizationId
    ? await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: session.user.id },
        },
        select: { role: true },
      })
    : null;

  if (!organizationId || !member) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Projets</h1>
        <p className="text-xs text-muted-foreground mt-2">
          Rejoignez une organisation pour créer des projets vidéo.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-semibold">Projets</h1>
      <VideoProjectList
        canDelete={canAct(member.role, "delete")}
        canUpdate={canAct(member.role, "update")}
      />
    </div>
  );
}
