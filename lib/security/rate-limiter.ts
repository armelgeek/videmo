export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Compte un appel sur `key` et rend le compte de la fenetre courante.
 *
 * Le compteur vivait dans la memoire de chaque instance : avec N instances, la
 * limite reelle etait multipliee par N. Il est desormais en base, partage.
 */
export interface RateLimitBackend {
  hit(key: string, windowSeconds: number): Promise<{ count: number; resetAt: number }>;
}

export class InMemoryRateLimitBackend implements RateLimitBackend {
  readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowSeconds: number) {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowSeconds * 1000 };
      this.buckets.set(key, fresh);
      return { ...fresh };
    }
    bucket.count++;
    return { ...bucket };
  }
}

/** Part des appels qui purgent au passage les fenetres expirees. */
const CLEANUP_PROBABILITY = 0.01;

export class PrismaRateLimitBackend implements RateLimitBackend {
  async hit(key: string, windowSeconds: number) {
    const { prisma } = await import("@/lib/prisma");
    // Une seule requete, atomique : lire puis ecrire laissait deux instances
    // compter le meme appel. L'horloge est celle de la base, commune a toutes,
    // en UTC : les colonnes sont sans fuseau et Prisma les lit comme UTC, alors
    // que now() suit le fuseau de la session — fenetres decalees de 3 h mesurees.
    const rows = await prisma.$queryRaw<{ count: number; reset_at: Date }[]>`
      INSERT INTO rate_limit_buckets (key, count, reset_at)
      VALUES (${key}, 1, timezone('utc', now()) + make_interval(secs => ${windowSeconds}))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limit_buckets.reset_at <= timezone('utc', now())
          THEN 1 ELSE rate_limit_buckets.count + 1 END,
        reset_at = CASE WHEN rate_limit_buckets.reset_at <= timezone('utc', now())
          THEN EXCLUDED.reset_at ELSE rate_limit_buckets.reset_at END
      RETURNING count, reset_at`;

    if (Math.random() < CLEANUP_PROBABILITY) {
      void prisma.$executeRaw`DELETE FROM rate_limit_buckets WHERE reset_at < timezone('utc', now())`.catch(
        () => {},
      );
    }

    const row = rows[0];
    return { count: Number(row.count), resetAt: new Date(row.reset_at).getTime() };
  }
}

let backend: RateLimitBackend = new PrismaRateLimitBackend();

/** Les tests passent le backend en memoire. */
export function setRateLimitBackend(next: RateLimitBackend): void {
  backend = next;
}

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 10, windowSeconds: 60 },
): Promise<RateLimitResult> {
  try {
    const { count, resetAt } = await backend.hit(`rl:${identifier}`, config.windowSeconds);
    return {
      success: count <= config.limit,
      limit: config.limit,
      remaining: Math.max(0, config.limit - count),
      resetAt,
    };
  } catch (error) {
    // Une base indisponible ne doit pas fermer la connexion ni les paiements :
    // on laisse passer, et on le dit.
    console.error("[rate-limit] backend unavailable, allowing request:", error);
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      resetAt: Date.now() + config.windowSeconds * 1000,
    };
  }
}

/** `resetAt` y est un DELAI en ms avant la remise a zero, comme avant. */
export function createRateLimitMiddleware(maxRequests = 10, windowMs = 60 * 1000) {
  return async (identifier: string) => {
    const result = await rateLimit(identifier, {
      limit: maxRequests,
      windowSeconds: Math.ceil(windowMs / 1000),
    });
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: Math.max(0, result.resetAt - Date.now()),
    };
  };
}

export function getClientIdentifier(headers: Headers, fallback = "unknown"): string {
  const forwarded = headers.get("x-forwarded-for");
  const realIp = headers.get("x-real-ip");
  const cfConnectingIp = headers.get("cf-connecting-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return fallback;
}

export const authRateLimit = (ip: string) =>
  rateLimit(`auth:${ip}`, { limit: 10, windowSeconds: 60 });

export const passwordResetRateLimit = (ip: string) =>
  rateLimit(`pwd-reset:${ip}`, { limit: 3, windowSeconds: 300 });

export const signupRateLimit = (ip: string) =>
  rateLimit(`signup:${ip}`, { limit: 5, windowSeconds: 60 });

/**
 * AI generation, per user: every call is billed by the provider and holds a
 * request for minutes. Images get a wider budget because a storyboard asks for
 * one per scene.
 */
const AI_LIMITS = {
  images: { limit: 120, windowSeconds: 600 },
  narration: { limit: 60, windowSeconds: 600 },
  script: { limit: 20, windowSeconds: 600 },
  storyboard: { limit: 20, windowSeconds: 600 },
} as const;

export const aiGenerationRateLimit = (userId: string, kind: keyof typeof AI_LIMITS) =>
  rateLimit(`ai:${kind}:${userId}`, AI_LIMITS[kind]);

export function tooManyGenerations(resetAt: number): Response {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return Response.json(
    { error: "Trop de generations en peu de temps. Reessayez dans quelques minutes." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
