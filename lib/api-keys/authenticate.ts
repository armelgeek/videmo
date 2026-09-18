import crypto from "node:crypto";
import { getOrgPlan } from "@/lib/billing/plan-gating";
import { prisma } from "@/lib/prisma";

export const API_KEY_PREFIX = "sk_live_";

export class ApiKeyRejectedError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "ApiKeyRejectedError";
  }
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function readBearerApiKey(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  return token?.startsWith(API_KEY_PREFIX) ? token : null;
}

export async function authenticateApiKey(
  rawKey: string,
): Promise<{ userId: string; organizationId: string }> {
  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(rawKey) },
    select: { id: true, userId: true, organizationId: true, revokedAt: true, expiresAt: true },
  });
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date())) {
    throw new ApiKeyRejectedError("Invalid or revoked API key", 401);
  }
  if (!key.organizationId) {
    throw new ApiKeyRejectedError(
      "This key was created before keys were tied to an organization. Create a new one.",
      401,
    );
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: key.organizationId, userId: key.userId },
    select: { id: true },
  });
  if (!membership) throw new ApiKeyRejectedError("The key owner left this organization", 401);

  const plan = await getOrgPlan(key.organizationId);
  if (plan.features.api_access !== true) {
    throw new ApiKeyRejectedError(`API access is not included in the ${plan.name} plan.`, 403);
  }

  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: key.userId, organizationId: key.organizationId };
}
