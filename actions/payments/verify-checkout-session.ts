"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/payments/stripe/config";
import { handleCheckoutSessionCompleted } from "@/lib/webhooks/stripe/handlers";

// The webhook stays the source of truth; this only closes the gap when the user lands before it.
export const verifyCheckoutSession = async (sessionId: string) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { error: "Unauthorized" };

    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return { error: "Invalid session" };
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Answering "not found" keeps other users' session ids from being probed.
    if (checkoutSession.metadata?.userId !== session.user.id) {
      return { error: "Session not found" };
    }
    if (checkoutSession.payment_status !== "paid") {
      return { error: "Payment not completed" };
    }

    const result = await handleCheckoutSessionCompleted(checkoutSession);
    if (result.kind === "ignored") return { error: "Invalid session data" };

    return {
      success: true,
      alreadyExists: result.kind === "subscription" ? !result.created : !result.applied,
    };
  } catch (error) {
    console.error("[billing] Checkout session verification failed:", error);
    return { error: "Failed to verify checkout session" };
  }
};
