/** Un evenement plus vieux n'est plus traite : Stripe ne le renverrait pas. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Une reclamation sans conclusion depuis ce delai vient d'une instance tombee
 * en plein traitement : un nouvel envoi peut reprendre l'evenement.
 */
export const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Les evenements deja pris en charge, partages par toutes les instances.
 *
 * Le registre vivait en memoire : deux instances pouvaient traiter le meme
 * paiement. La reclamation est atomique, avant le traitement, et non plus une
 * simple marque apres coup.
 */
export interface WebhookEventBackend {
  /** true si CETTE instance obtient l'evenement. */
  claim(eventId: string, eventType: string): Promise<boolean>;
  complete(eventId: string): Promise<void>;
  /** Rend l'evenement apres un echec, pour que le renvoi de Stripe le traite. */
  release(eventId: string): Promise<void>;
}

export class InMemoryWebhookEventBackend implements WebhookEventBackend {
  readonly events = new Map<string, { claimedAt: number; completedAt: number | null }>();

  async claim(eventId: string) {
    const now = Date.now();
    const existing = this.events.get(eventId);
    if (existing && (existing.completedAt !== null || now - existing.claimedAt < CLAIM_TIMEOUT_MS)) {
      return false;
    }
    this.events.set(eventId, { claimedAt: now, completedAt: null });
    return true;
  }

  async complete(eventId: string) {
    const existing = this.events.get(eventId);
    if (existing) existing.completedAt = Date.now();
  }

  async release(eventId: string) {
    if (this.events.get(eventId)?.completedAt === null) this.events.delete(eventId);
  }
}

export class PrismaWebhookEventBackend implements WebhookEventBackend {
  async claim(eventId: string, eventType: string) {
    const { prisma } = await import("@/lib/prisma");
    // En UTC, comme Prisma lit ces colonnes sans fuseau.
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO processed_webhook_events (id, type, claimed_at)
      VALUES (${eventId}, ${eventType}, timezone('utc', now()))
      ON CONFLICT (id) DO UPDATE SET claimed_at = timezone('utc', now())
      WHERE processed_webhook_events.completed_at IS NULL
        AND processed_webhook_events.claimed_at < timezone('utc', now()) - make_interval(secs => ${CLAIM_TIMEOUT_MS / 1000})
      RETURNING id`;
    return rows.length > 0;
  }

  async complete(eventId: string) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.processedWebhookEvent.updateMany({
      where: { id: eventId },
      data: { completedAt: new Date() },
    });
  }

  async release(eventId: string) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.processedWebhookEvent.deleteMany({
      where: { id: eventId, completedAt: null },
    });
  }
}

let backend: WebhookEventBackend = new PrismaWebhookEventBackend();

/** Les tests passent le backend en memoire. */
export function setWebhookEventBackend(next: WebhookEventBackend): void {
  backend = next;
}

const logError = (context: string) => (error: unknown) =>
  console.error(`[webhook-events] ${context}:`, error);

export interface EventGuard {
  shouldProcess: boolean;
  reason?: string;
  markProcessed: () => Promise<void>;
  release: () => Promise<void>;
}

const noop = async () => {};

export async function createEventGuard(
  eventId: string,
  eventType: string,
  created: number,
): Promise<EventGuard> {
  const age = Date.now() - created * 1000;
  if (age > MAX_AGE_MS) {
    return {
      shouldProcess: false,
      reason: `Event is too old: ${Math.floor(age / 1000 / 60)} minutes old`,
      markProcessed: noop,
      release: noop,
    };
  }

  let claimed: boolean;
  try {
    claimed = await backend.claim(eventId, eventType);
  } catch (error) {
    // Base indisponible : les handlers y ecrivent aussi, donc ils echoueront
    // et Stripe renverra. Refuser ici perdrait l'evenement pour de bon.
    logError("claim")(error);
    claimed = true;
  }

  if (!claimed) {
    return {
      shouldProcess: false,
      reason: "Event already processed or being processed",
      markProcessed: noop,
      release: noop,
    };
  }

  return {
    shouldProcess: true,
    markProcessed: () => backend.complete(eventId).catch(logError("complete")),
    release: () => backend.release(eventId).catch(logError("release")),
  };
}
