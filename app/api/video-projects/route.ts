import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAct } from "@/lib/video-project/access";
import { ProjectForbiddenError, ProjectNotFoundError } from "@/lib/video-project/errors";
import { lockState } from "@/lib/video-project/lock";
import { prismaProjectAccessDeps } from "@/lib/video-project/repository";
import {
  DEFAULT_DOCUMENTS,
  createVideoProjectSchema,
  listVideoProjectsSchema,
} from "@/lib/video-project/schema";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

// Jamais les colonnes Json : un panels[] complet par ligne rendrait la liste
// inutilisable.
const LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  step: true,
  aspectRatio: true,
  updatedAt: true,
  lockedById: true,
  lockExpiresAt: true,
  createdBy: { select: { id: true, name: true } },
  lockedBy: { select: { id: true, name: true } },
} as const;

async function requireRole(viewer: { userId: string; organizationId: string | null }) {
  if (!viewer.organizationId) throw new ProjectNotFoundError();
  const role = await prismaProjectAccessDeps.findRole(
    viewer.organizationId,
    viewer.userId,
  );
  if (!role) throw new ProjectNotFoundError();
  return { organizationId: viewer.organizationId, role };
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const { organizationId, role } = await requireRole(viewer);
    if (!canAct(role, "read")) throw new ProjectForbiddenError();

    const { page, limit, search } = listVideoProjectsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const where = {
      organizationId,
      deletedAt: null,
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.videoProject.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.videoProject.count({ where }),
    ]);

    const now = new Date();
    const data = rows.map(({ lockedById, lockExpiresAt, lockedBy, ...rest }) => ({
      ...rest,
      lock: {
        state: lockState({ lockedById, lockExpiresAt }, viewer.userId, now),
        byId: lockedById,
        by: lockedBy,
        expiresAt: lockExpiresAt,
      },
    }));

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const { organizationId, role } = await requireRole(viewer);
    if (!canAct(role, "create")) throw new ProjectForbiddenError();

    const { title } = createVideoProjectSchema.parse(await request.json());

    const project = await prisma.videoProject.create({
      data: {
        organizationId,
        createdById: viewer.userId,
        title,
        params: DEFAULT_DOCUMENTS.params as Prisma.InputJsonValue,
        script: DEFAULT_DOCUMENTS.script as Prisma.InputJsonValue,
        panels: DEFAULT_DOCUMENTS.panels as Prisma.InputJsonValue,
        whiteboardConfig: DEFAULT_DOCUMENTS.whiteboardConfig as Prisma.InputJsonValue,
      },
      select: LIST_SELECT,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
