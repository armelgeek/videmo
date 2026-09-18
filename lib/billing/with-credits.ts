import type { CreditAction } from "./catalog";
import { consume, refund } from "./credit-service";
import {
  FeatureNotAvailableError,
  InsufficientCreditsError,
  QuotaExceededError,
} from "./errors";

const formatDuration = (seconds: number) =>
  seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;

const QUOTA_MESSAGES: Record<string, (limit: number) => string> = {
  max_projects: (limit) =>
    `Your plan allows ${limit} project${limit === 1 ? "" : "s"}. Upgrade or delete a project to create another.`,
  max_org_members: (limit) =>
    `Your plan allows ${limit} member${limit === 1 ? "" : "s"}, pending invitations included. Upgrade to invite more.`,
  max_export_resolution: (limit) => `Your plan exports up to ${limit}p. Upgrade for a higher resolution.`,
  max_video_duration_sec: (limit) =>
    `Your plan exports videos up to ${formatDuration(limit)}. Shorten this one or upgrade.`,
};

export function billingErrorResponse(error: unknown): Response | null {
  if (error instanceof InsufficientCreditsError) {
    return Response.json(
      {
        error: `This needs ${error.required} credits and your organization has ${error.balance}.`,
        code: "insufficient_credits",
        balance: error.balance,
        required: error.required,
      },
      { status: 402 },
    );
  }
  if (error instanceof QuotaExceededError) {
    return Response.json(
      {
        error: QUOTA_MESSAGES[error.quotaKey]?.(error.limit) ?? "Plan limit reached",
        code: "quota_exceeded",
        quota: error.quotaKey,
        limit: error.limit,
        current: error.current,
      },
      { status: 403 },
    );
  }
  if (error instanceof FeatureNotAvailableError) {
    return Response.json(
      {
        error: `This feature is not included in the ${error.tier} plan.`,
        code: "feature_unavailable",
        feature: error.feature,
        tier: error.tier,
      },
      { status: 403 },
    );
  }
  return null;
}

export interface ChargeDeps {
  consume: (input: Parameters<typeof consume>[0]) => Promise<{ id: string }>;
  refund: (consumptionId: string, reason?: string) => Promise<unknown>;
}

const defaultDeps: ChargeDeps = { consume, refund };

export interface ChargeContext {
  userId: string;
  organizationId: string | null;
}

// Debits before the paid work and refunds when it throws or answers non-2xx.
export async function chargeFor(
  viewer: ChargeContext,
  action: CreditAction,
  run: () => Promise<Response>,
  options: { referenceId?: string; deps?: ChargeDeps } = {},
): Promise<Response> {
  const deps = options.deps ?? defaultDeps;
  if (!viewer.organizationId) {
    return Response.json({ error: "No active organization" }, { status: 403 });
  }

  let consumption: { id: string };
  try {
    consumption = await deps.consume({
      organizationId: viewer.organizationId,
      userId: viewer.userId,
      action,
      referenceId: options.referenceId,
    });
  } catch (error) {
    const response = billingErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const refundQuietly = async (reason: string) => {
    try {
      await deps.refund(consumption.id, reason);
    } catch (refundError) {
      console.error(`[billing] refund of ${consumption.id} failed`, refundError);
    }
  };

  let response: Response;
  try {
    response = await run();
  } catch (error) {
    await refundQuietly("Generation failed");
    throw error;
  }

  if (!response.ok) await refundQuietly(`Generation failed (${response.status})`);
  return response;
}
