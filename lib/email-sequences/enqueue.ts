import { prisma } from "@/lib/prisma";
import { onboardingSchedule, previousMonthKey } from "./schedule";

export async function enqueueOnboarding(userId: string, verifiedAt = new Date()): Promise<void> {
  await prisma.scheduledEmail.createMany({
    data: onboardingSchedule(verifiedAt).map((email) => ({ userId, ...email })),
    skipDuplicates: true,
  });
}

// Safe to run every day: the unique (userId, kind) key creates each month's digest once.
export async function enqueueMonthlyDigests(now = new Date()): Promise<number> {
  const kind = `digest:${previousMonthKey(now)}`;
  const users = await prisma.user.findMany({
    where: { emailVerified: true, marketingEmailsOptOut: false, createdAt: { lt: now } },
    select: { id: true },
  });
  const { count } = await prisma.scheduledEmail.createMany({
    data: users.map((u) => ({ userId: u.id, kind, sendAt: now })),
    skipDuplicates: true,
  });
  return count;
}
