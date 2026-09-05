import { prisma } from "@/lib/prisma";
import { type ProjectAction, canAct } from "./access";
import { ProjectForbiddenError, ProjectNotFoundError } from "./errors";

export interface AccessibleProject {
  id: string;
  organizationId: string;
  deletedAt: Date | null;
}

export interface ProjectAccessDeps {
  findProject(id: string): Promise<AccessibleProject | null>;
  findRole(organizationId: string, userId: string): Promise<string | null>;
}

export const prismaProjectAccessDeps: ProjectAccessDeps = {
  findProject: (id) =>
    prisma.videoProject.findUnique({
      where: { id },
      select: { id: true, organizationId: true, deletedAt: true },
    }),
  findRole: async (organizationId, userId) => {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    return member?.role ?? null;
  },
};

/**
 * Tout ce qui n'est pas « membre à qui son rôle refuse l'action » rend
 * NotFound : répondre Forbidden confirmerait l'existence d'un projet que
 * l'appelant n'a pas le droit de voir.
 */
export async function requireProjectAccess(
  projectId: string,
  viewer: { userId: string; organizationId: string | null },
  action: ProjectAction,
  deps: ProjectAccessDeps = prismaProjectAccessDeps,
): Promise<{ project: AccessibleProject; role: string }> {
  if (!viewer.organizationId) throw new ProjectNotFoundError();

  const project = await deps.findProject(projectId);
  if (!project || project.deletedAt) throw new ProjectNotFoundError();
  if (project.organizationId !== viewer.organizationId) {
    throw new ProjectNotFoundError();
  }

  const role = await deps.findRole(project.organizationId, viewer.userId);
  if (!role) throw new ProjectNotFoundError();
  if (!canAct(role, action)) throw new ProjectForbiddenError();

  return { project, role };
}
