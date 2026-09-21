"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

export async function getRedirectUrl(next?: string | null): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return "/login";
  }

  const requested = safeRedirectPath(next);
  if (requested) return requested;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  // Everyone else lands in the studio. /profile is a settings form: a poor
  // first screen for an account that has never made a video.
  return user?.isAdmin ? "/dashboard" : "/";
}
