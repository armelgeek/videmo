import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectLockedError, ProjectNotFoundError } from "@/lib/video-project/errors";
import { acquireLock, lockState } from "@/lib/video-project/lock";
import { requireProjectAccess } from "@/lib/video-project/repository";
import {
  assertNoDataUrl,
  updateVideoProjectSchema,
} from "@/lib/video-project/schema";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

const FULL_SELECT = {
  id: true,
  title: true,
  status: true,
  step: true,
  aspectRatio: true,
  params: true,
  script: true,
  panels: true,
  whiteboardConfig: true,
  schemaVersion: true,
  updatedAt: true,
  lockedById: true,
  lockExpiresAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

async function loadFull(id: string, userId: string) {
  const row = await prisma.videoProject.findUnique({
    where: { id },
    select: FULL_SELECT,
  });
  if (!row) throw new ProjectNotFoundError();

  const { lockedById, lockExpiresAt, ...rest } = row;
  return {
    ...rest,
    lock: {
      state: lockState({ lockedById, lockExpiresAt }, userId, new Date()),
      byId: lockedById,
      expiresAt: lockExpiresAt,
    },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "read");
    return NextResponse.json(await loadFull(id, viewer.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "update");

    const patch = updateVideoProjectSchema.parse(await request.json());
    assertNoDataUrl(patch);

    const current = await prisma.videoProject.findUnique({
      where: { id },
      select: { lockedById: true, lockExpiresAt: true },
    });
    if (!current) throw new ProjectNotFoundError();

    const now = new Date();
    if (lockState(current, viewer.userId, now) !== "held-by-me") {
      throw new ProjectLockedError(current.lockedById, current.lockExpiresAt);
    }

    // Une frappe continue renouvelle le bail d'elle-même : le chantier 3 n'a
    // pas besoin d'un battement séparé tant que l'utilisateur écrit.
    const renewed = acquireLock(current, viewer.userId, now);

    const { params: docParams, script, panels, whiteboardConfig, ...rest } = patch;
    await prisma.videoProject.update({
      where: { id },
      data: {
        ...rest,
        ...(docParams !== undefined
          ? { params: docParams as Prisma.InputJsonValue }
          : {}),
        ...(script !== undefined
          ? { script: script as Prisma.InputJsonValue }
          : {}),
        ...(panels !== undefined
          ? { panels: panels as Prisma.InputJsonValue }
          : {}),
        ...(whiteboardConfig !== undefined
          ? { whiteboardConfig: whiteboardConfig as Prisma.InputJsonValue }
          : {}),
        ...renewed,
      },
    });

    return NextResponse.json(await loadFull(id, viewer.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "delete");

    const current = await prisma.videoProject.findUnique({
      where: { id },
      select: { lockedById: true, lockExpiresAt: true },
    });
    if (!current) throw new ProjectNotFoundError();

    if (lockState(current, viewer.userId, new Date()) === "held-by-other") {
      throw new ProjectLockedError(current.lockedById, current.lockExpiresAt);
    }

    await prisma.videoProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Un corps, et non 204 : apiCall (lib/client.ts:21) appelle toujours
    // response.json(), donc une réponse vide ferait échouer api.delete.
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
