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

export interface Viewer {
  userId: string;
  organizationId: string | null;
}

/**
 * La part de la doctrine qui ne dépend d'aucun projet. Les routes de liste et de
 * création n'ont pas d'id à fournir : sans ce point d'entrée partagé, elles
 * réécrivaient les mêmes deux gardes, et rien ne comparait les deux versions.
 */
export async function requireOrganizationRole(
  viewer: Viewer,
  deps: ProjectAccessDeps = prismaProjectAccessDeps,
): Promise<{ organizationId: string; role: string }> {
  if (!viewer.organizationId) throw new ProjectNotFoundError();

  const role = await deps.findRole(viewer.organizationId, viewer.userId);
  if (!role) throw new ProjectNotFoundError();

  return { organizationId: viewer.organizationId, role };
}

/**
 * Tout ce qui n'est pas « membre à qui son rôle refuse l'action » rend
 * NotFound : répondre Forbidden confirmerait l'existence d'un projet que
 * l'appelant n'a pas le droit de voir.
 */
export async function requireProjectAccess(
  projectId: string,
  viewer: Viewer,
  action: ProjectAction,
  deps: ProjectAccessDeps = prismaProjectAccessDeps,
): Promise<{ project: AccessibleProject; role: string }> {
  const { organizationId, role } = await requireOrganizationRole(viewer, deps);

  const project = await deps.findProject(projectId);
  if (!project || project.deletedAt) throw new ProjectNotFoundError();
  if (project.organizationId !== organizationId) {
    throw new ProjectNotFoundError();
  }

  if (!canAct(role, action)) throw new ProjectForbiddenError();

  return { project, role };
}
