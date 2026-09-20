import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectLockedError, ProjectNotFoundError } from "@/lib/video-project/errors";
import { LOCK_TTL_MS } from "@/lib/video-project/lock";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "update");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    // The condition is in the WHERE, not in a prior read: two members
    // clicking at the same time cannot both obtain it.
    const { count } = await prisma.videoProject.updateMany({
      where: {
        id,
        deletedAt: null,
        OR: [
          { lockedById: null },
          { lockedById: viewer.userId },
          { lockExpiresAt: null },
          { lockExpiresAt: { lte: now } },
        ],
      },
      data: { lockedById: viewer.userId, lockExpiresAt: expiresAt },
    });

    if (count === 0) {
      const holder = await prisma.videoProject.findUnique({
        where: { id },
        select: {
          deletedAt: true,
          lockedById: true,
          lockExpiresAt: true,
          // The response shows who holds the lock: an id alone means nothing
          // to the member who is locked out.
          lockedBy: { select: { name: true } },
        },
      });
      // deletedAt is part of the select: without it, a project deleted during the
      // race would return « locked » even though it no longer exists.
      if (!holder || holder.deletedAt) throw new ProjectNotFoundError();
      throw new ProjectLockedError(
        holder.lockedById,
        holder.lockedBy?.name ?? null,
        holder.lockExpiresAt,
      );
    }

    return NextResponse.json({ lockedById: viewer.userId, expiresAt });
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
    await requireProjectAccess(id, viewer, "update");

    await prisma.videoProject.updateMany({
      where: { id, lockedById: viewer.userId },
      data: { lockedById: null, lockExpiresAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
