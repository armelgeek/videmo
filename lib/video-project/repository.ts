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
 * The part of the doctrine that depends on no project. The list and create
 * routes have no id to provide: without this shared entry point they
 * rewrote the same two guards, and nothing compared the two versions.
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
 * Anything other than "a member whose role forbids the action" yields
 * NotFound: answering Forbidden would confirm the existence of a project the
 * caller is not allowed to see.
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
