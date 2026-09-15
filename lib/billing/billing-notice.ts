export const CREDITS_CHANGED_EVENT = "credits-changed";

export function notifyCreditsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}

export interface BillingNotice {
  message: string;
  actionLabel: string;
  href: string;
}

export function billingNoticeFor(status: number, body: unknown): BillingNotice | null {
  if (!body || typeof body !== "object") return null;
  const { code, error } = body as { code?: unknown; error?: unknown };
  const message = typeof error === "string" ? error : "";

  if (status === 402 && code === "insufficient_credits") {
    return {
      message: message || "Not enough credits",
      actionLabel: "Buy credits",
      href: "/billing?topup=open",
    };
  }
  if (status === 403 && (code === "quota_exceeded" || code === "feature_unavailable")) {
    return {
      message: message || "Not available on your plan",
      actionLabel: "Upgrade",
      href: "/#pricing",
    };
  }
  return null;
}

// Low once under a fifth of the monthly allowance, so the warning shows before generation fails.
export function creditLevel(balance: number, monthlyAllowance: number): "ok" | "low" {
  if (monthlyAllowance <= 0) return balance > 0 ? "ok" : "low";
  return balance < monthlyAllowance * 0.2 ? "low" : "ok";
}
