import { timingSafeEqual } from "node:crypto";

export const MIN_CRON_SECRET_LENGTH = 32;

// Fails closed: a missing or weak secret must never leave the job callable by anyone.
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) return false;
  if (!authorization?.startsWith("Bearer ")) return false;

  const given = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
