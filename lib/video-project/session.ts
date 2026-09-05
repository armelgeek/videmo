import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveActiveOrganization } from "@/lib/auth-organization";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import {
  EphemeralUrlRejectedError,
  ProjectForbiddenError,
  ProjectLockedError,
  ProjectNotFoundError,
} from "./errors";

export class ProjectUnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "ProjectUnauthorizedError";
  }
}

export interface Viewer {
  userId: string;
  organizationId: string | null;
}

export async function requireViewer(): Promise<Viewer> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new ProjectUnauthorizedError();

  const organizationId = await resolveActiveOrganization(
    {
      id: session.session.id,
      userId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    },
    prismaOrganizationRepository,
  );

  return { userId: session.user.id, organizationId };
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ProjectUnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ProjectNotFoundError) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (error instanceof ProjectForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof ProjectLockedError) {
    return NextResponse.json(
      {
        error: "Project is being edited",
        lockedBy: error.lockedById,
        expiresAt: error.lockExpiresAt,
      },
      { status: 409 },
    );
  }
  if (error instanceof EphemeralUrlRejectedError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.issues },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
