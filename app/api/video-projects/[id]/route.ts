import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectLockedError, ProjectNotFoundError } from "@/lib/video-project/errors";
import { LOCK_TTL_MS, lockState } from "@/lib/video-project/lock";
import { requireProjectAccess } from "@/lib/video-project/repository";
import {
  assertNoEphemeralUrl,
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
  lockedBy: { select: { id: true, name: true } },
} as const;

async function loadFull(id: string, userId: string) {
  const row = await prisma.videoProject.findUnique({
    where: { id },
    select: FULL_SELECT,
  });
  if (!row) throw new ProjectNotFoundError();

  const { lockedById, lockExpiresAt, lockedBy, ...rest } = row;
  return {
    ...rest,
    lock: {
      state: lockState({ lockedById, lockExpiresAt }, userId, new Date()),
      byId: lockedById,
      by: lockedBy,
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
    assertNoEphemeralUrl(patch);

    const now = new Date();
    // Continuous typing renews the lease on its own: workstream 3 does not
    // need a separate heartbeat while the user is writing.
    const renewed = {
      lockedById: viewer.userId,
      lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS),
    };

    const { params: docParams, script, panels, whiteboardConfig, ...rest } = patch;
    // Holding the lease is a WHERE condition, as in lock/route.ts: read then
    // written, it could expire in between and this write would steal the
    // lease someone else just took.
    const { count } = await prisma.videoProject.updateMany({
      where: {
        id,
        deletedAt: null,
        lockedById: viewer.userId,
        lockExpiresAt: { gt: now },
      },
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

    if (count === 0) {
      const holder = await prisma.videoProject.findUnique({
        where: { id },
        select: { deletedAt: true, lockedById: true, lockExpiresAt: true },
      });
      // deletedAt is part of the select: without it, a project deleted during the
      // race would return « locked » even though it no longer exists.
      if (!holder || holder.deletedAt) throw new ProjectNotFoundError();
      throw new ProjectLockedError(holder.lockedById, holder.lockExpiresAt);
    }

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

    // A body, not 204: apiCall (lib/client.ts:21) always calls
    // response.json(), so an empty response would make api.delete fail.
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
