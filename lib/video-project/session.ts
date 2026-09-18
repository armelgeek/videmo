import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveActiveOrganization } from "@/lib/auth-organization";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import { ApiKeyRejectedError, authenticateApiKey, readBearerApiKey } from "@/lib/api-keys/authenticate";
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

/** Signed-in user, or an API key holder when the request carries `Authorization: Bearer sk_live_…`. */
export async function requireViewer(): Promise<Viewer> {
  const apiKey = readBearerApiKey((await headers()).get("authorization"));
  if (apiKey) return authenticateApiKey(apiKey);
  return requireSessionViewer();
}

/** Browser session only: for actions an API key must never perform, like managing keys. */
export async function requireSessionViewer(): Promise<Viewer> {
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
  if (error instanceof ApiKeyRejectedError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
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
        lockedBy: error.lockedByName || error.lockedById,
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
