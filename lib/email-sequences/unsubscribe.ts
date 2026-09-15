import { createHmac, timingSafeEqual } from "node:crypto";

function sign(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("base64url");
}

export function unsubscribeSignature(userId: string, secret: string | undefined): string {
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required to sign unsubscribe links");
  return sign(userId, secret);
}

export function isValidUnsubscribeSignature(
  userId: string | null,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!userId || !signature || !secret) return false;
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(userId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function unsubscribeUrl(baseUrl: string, userId: string, secret: string | undefined): string {
  const params = new URLSearchParams({ u: userId, s: unsubscribeSignature(userId, secret) });
  return `${baseUrl}/api/emails/unsubscribe?${params}`;
}
