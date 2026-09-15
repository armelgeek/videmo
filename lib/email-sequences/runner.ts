import { appConfig } from "@/lib/config";
import { EmailService } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";
import type { SendEmailRequest } from "@/types/email";
import { monthRange, parseKind } from "./schedule";
import { unsubscribeUrl } from "./unsubscribe";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 100;
const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

type Outcome = "sent" | "skipped" | "failed";

async function buildEmail(
  kind: string,
  user: { id: string; email: string; name: string },
): Promise<SendEmailRequest | null> {
  const parsed = parseKind(kind);
  if (!parsed) return null;
  const common = {
    recipientEmail: user.email,
    recipientName: user.name,
    unsubscribeUrl: unsubscribeUrl(appConfig.url, user.id, process.env.BETTER_AUTH_SECRET),
  };

  if (parsed.type === "onboarding") {
    if (parsed.step === 1) {
      const hasProject = await prisma.videoProject.count({ where: { createdById: user.id } });
      if (hasProject > 0) return null;
    }
    return { type: "onboarding", recipients: [user.email], data: { ...common, step: parsed.step } };
  }

  const { start, end } = monthRange(parsed.month);
  const [projectsCreated, consumption] = await Promise.all([
    prisma.videoProject.count({
      where: { createdById: user.id, deletedAt: null, createdAt: { gte: start, lt: end } },
    }),
    prisma.creditTransaction.aggregate({
      where: { userId: user.id, type: "consumption", createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);
  const creditsUsed = Math.abs(consumption._sum.amount ?? 0);
  if (projectsCreated === 0 && creditsUsed === 0) return null;

  const monthLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return {
    type: "monthly_digest",
    recipients: [user.email],
    data: { ...common, monthLabel, projectsCreated, creditsUsed },
  };
}

export async function processDueEmails(now = new Date()): Promise<Record<Outcome, number>> {
  const counts: Record<Outcome, number> = { sent: 0, skipped: 0, failed: 0 };
  const staleClaim = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const due = await prisma.scheduledEmail.findMany({
    where: {
      sentAt: null,
      sendAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaim } }],
    },
    orderBy: { sendAt: "asc" },
    take: BATCH_SIZE,
    include: { user: { select: { id: true, email: true, name: true, marketingEmailsOptOut: true } } },
  });

  const emailService = new EmailService();
  for (const row of due) {
    // Another cron run may have claimed the row between the read and this update.
    const { count } = await prisma.scheduledEmail.updateMany({
      where: { id: row.id, sentAt: null, OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaim } }] },
      data: { claimedAt: now, attempts: { increment: 1 } },
    });
    if (count === 0) continue;

    try {
      const email = row.user.marketingEmailsOptOut ? null : await buildEmail(row.kind, row.user);
      if (email) await emailService.sendEmail(email);
      await prisma.scheduledEmail.update({
        where: { id: row.id },
        data: { sentAt: new Date(), lastError: email ? null : "skipped" },
      });
      counts[email ? "sent" : "skipped"]++;
    } catch (error) {
      await prisma.scheduledEmail.update({
        where: { id: row.id },
        data: { claimedAt: null, lastError: error instanceof Error ? error.message : String(error) },
      });
      counts.failed++;
    }
  }
  return counts;
}
