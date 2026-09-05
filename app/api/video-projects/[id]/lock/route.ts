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

    // La condition est dans le WHERE, pas dans une lecture préalable : deux
    // membres qui cliquent en même temps ne peuvent pas l'obtenir tous deux.
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
        select: { deletedAt: true, lockedById: true, lockExpiresAt: true },
      });
      // deletedAt fait partie du select : sans lui, un projet supprimé dans la
      // course rendrait « verrouillé » alors qu'il n'existe plus.
      if (!holder || holder.deletedAt) throw new ProjectNotFoundError();
      throw new ProjectLockedError(holder.lockedById, holder.lockExpiresAt);
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
