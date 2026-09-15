import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { assertProjectQuota } from "@/lib/billing/org-usage";
import { billingErrorResponse } from "@/lib/billing/with-credits";
import { prisma } from "@/lib/prisma";
import { canAct } from "@/lib/video-project/access";
import { ProjectForbiddenError } from "@/lib/video-project/errors";
import { lockState } from "@/lib/video-project/lock";
import { requireOrganizationRole } from "@/lib/video-project/repository";
import {
  DEFAULT_DOCUMENTS,
  createVideoProjectSchema,
  listVideoProjectsSchema,
} from "@/lib/video-project/schema";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

/** Same lifetime as the render route keeps a video in storage. */
const RENDER_DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;

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

// Reads only the first hosted image and the scene count out of panels, in SQL,
// so the list never ships whole panel documents.
async function loadPreviews(ids: string[]) {
  if (ids.length === 0) return new Map<string, { previewUrl: string | null; sceneCount: number }>();

  const rows = await prisma.$queryRaw<
    { id: string; preview_url: string | null; scene_count: number }[]
  >`
    SELECT
      p.id,
      (
        SELECT elem->>'imageUrl'
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p.panels::jsonb) = 'array' THEN p.panels::jsonb ELSE '[]'::jsonb END
        ) AS elem
        WHERE coalesce(elem->>'imageUrl', '') <> ''
        LIMIT 1
      ) AS preview_url,
      CASE WHEN jsonb_typeof(p.panels::jsonb) = 'array'
        THEN jsonb_array_length(p.panels::jsonb) ELSE 0 END::int AS scene_count
    FROM "VideoProject" p
    WHERE p.id IN (${Prisma.join(ids)})
  `;

  return new Map(
    rows.map((row) => [row.id, { previewUrl: row.preview_url, sceneCount: row.scene_count }]),
  );
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const { organizationId, role } = await requireOrganizationRole(viewer);
    if (!canAct(role, "read")) throw new ProjectForbiddenError();

    const { page, limit, search } = listVideoProjectsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const where = {
      organizationId,
      deletedAt: null,
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [rows, total, organization] = await Promise.all([
      prisma.videoProject.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.videoProject.count({ where }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const previews = await loadPreviews(rows.map((row) => row.id));

    const now = new Date();

    // The viewer's own videos only: the download route serves a job to its owner alone.
    const exports = await prisma.renderJob.findMany({
      where: {
        userId: viewer.userId,
        projectId: { in: rows.map((row) => row.id) },
        status: "done",
        outputKey: { not: null },
        createdAt: { gte: new Date(now.getTime() - RENDER_DOWNLOAD_TTL_MS) },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["projectId"],
      select: { id: true, projectId: true, createdAt: true },
    });
    const latestExport = new Map(exports.map((job) => [job.projectId, job]));
    const data = rows.map(({ lockedById, lockExpiresAt, lockedBy, ...rest }) => ({
      ...rest,
      previewUrl: previews.get(rest.id)?.previewUrl ?? null,
      sceneCount: previews.get(rest.id)?.sceneCount ?? 0,
      latestExport: latestExport.has(rest.id)
        ? {
            jobId: latestExport.get(rest.id)!.id,
            createdAt: latestExport.get(rest.id)!.createdAt,
          }
        : null,
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
      // A personal workspace is recognised by the slug ensurePersonalOrganization gives it.
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            isPersonal: organization.slug.startsWith("personal-"),
          }
        : null,
      viewer: {
        role,
        canCreate: canAct(role, "create"),
        canUpdate: canAct(role, "update"),
        canDelete: canAct(role, "delete"),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const { organizationId, role } = await requireOrganizationRole(viewer);
    if (!canAct(role, "create")) throw new ProjectForbiddenError();

    const { title, aspectRatio } = createVideoProjectSchema.parse(await request.json());
    await assertProjectQuota(organizationId);

    const project = await prisma.videoProject.create({
      data: {
        organizationId,
        createdById: viewer.userId,
        title,
        aspectRatio,
        params: DEFAULT_DOCUMENTS.params as Prisma.InputJsonValue,
        script: DEFAULT_DOCUMENTS.script as Prisma.InputJsonValue,
        panels: DEFAULT_DOCUMENTS.panels as Prisma.InputJsonValue,
        whiteboardConfig: DEFAULT_DOCUMENTS.whiteboardConfig as Prisma.InputJsonValue,
      },
      select: LIST_SELECT,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return billingErrorResponse(error) ?? toErrorResponse(error);
  }
}
