# Credits & Gating — Implementation Plan

Spec: `docs/credits-gating-system.md` (Revision 2 takes precedence). Each task = one commit, with its `.puml` in `docs/billing/` where it has a user-visible flow.

Verify for every task unless stated: `npx tsc --noEmit && npm test && npx biome check <touched files>`.

## Phase 0 — Security (ship independently, now)

**T0.1 — Authenticate `/api/video/generate`**
- `app/api/video/generate/route.ts`: `requireViewer()` + `aiGenerationRateLimit(viewer.userId, …)` (add a `video` entry to `AI_LIMITS` in `lib/security/rate-limiter.ts`), errors via `toErrorResponse`. Replace `request: any` with the inferred schema type.
- Check `app/api/video/status/[id]` and `app/api/video/chat` for the same gap; fix in the same commit if they have it.
- Consumers: `components/video-generation/video-generator.tsx`, `video-chat.tsx`, `video-chat-pro.tsx` (handle 401/429).
- Test: unauthenticated POST → 401.

## Phase 1 — Data

**T1.1 — Prisma schema + migration** `add_credits_and_gating`
- `Plan.tier`, `PlanQuota`, `PlanFeatureGate`, `CreditActionCost`, `CreditWallet(organizationId)`, `CreditTransaction(organizationId, userId?)`, `CreditPurchase(organizationId, userId)`, `Subscription.organizationId?`, `Organization.stripeCustomerId?`, back-relations on `Organization`/`User`.
- Verify: `npx prisma migrate dev --name add_credits_and_gating && npx prisma generate`.

**T1.2 — Seed rewrite** `scripts/seed-plans.ts`
- Tier definitions (spec 1.3, minus `organization_access`, `max_org_members` per R1) written to monthly + yearly rows; Free single row; action costs. Upserts only.
- Update `scripts/setup-stripe-plans.ts` / `update-stripe-ids.ts` so they skip `tier = "free"`.
- Verify: run twice, row counts unchanged.

**T1.3 — Backfill script** `scripts/migrate-billing-to-organizations.ts`
- `Subscription.organizationId` ← subscriber's personal org (`ensurePersonalOrganization`); `Organization.stripeCustomerId` ← `User.stripeCustomerId` for that org; wallets for every org with `resetAt` = subscription `currentPeriodEnd` or +1 month. Idempotent (skip ledger grant if a wallet exists).
- Follow-up migration making `Subscription.organizationId` required.

## Phase 2 — Services (`lib/billing/`)

**T2.1 — Errors + plan resolution**: `errors.ts` (`InsufficientCreditsError`, `QuotaExceededError`, `FeatureNotAvailableError`), `plan-gating-service.ts` (`getOrgPlan`, `hasFeature`, `checkQuota`, `getPlanLimits`, 60s cache + `invalidatePlanCache(orgId)`). Unit tests with a fake repository, like `lib/auth-organization.test.ts`.

**T2.2 — CreditService** `credit-service.ts`: `getWallet` (lazy upsert), `consume` (FOR UPDATE, FIFO plan → purchases by `expiresAt`), `refund`, `grantPurchasedCredits`, `switchPlan(orgId, planId)` (expire + grant + resetAt, one transaction), `runDueResets(now)`, `expirePurchases(now)`. Tests: concurrent consume never goes negative; refund restores; reset run twice = one grant; expiry removes only remaining credits.

**T2.3 — Route helper** `with-credits.ts`: `chargeFor(viewer, action, run)` → consume, run, refund on throw; maps errors to `402 { error, code: "insufficient_credits", balance, required }` and `403 quota_exceeded`.

## Phase 3 — Wiring

**T3.1 — AI routes**: `generate-script`, `generate-storyboard` (switch to `requireViewer()`), `generate-narration`, `generate-images` → `chargeFor`. Test per route: 402 when empty, balance unchanged after provider failure.

**T3.2 — Quotas**: project creation in `lib/video-project/repository.ts` (`max_projects`); invitation creation in `actions/organizations` / better-auth org hooks (`max_org_members`, members + pending invites); export resolution + watermark read `getPlanLimits` in the whiteboard render route.

**T3.3 — Stripe webhooks** `lib/webhooks/stripe/handlers/index.ts`: branch on `session.mode`; subscription create/update stores real period + raw status and calls `switchPlan`; deleted → Free; top-up creates `CreditPurchase` (unique `stripePaymentId`) + grant. Delete `handlers/invoice.ts`. Tests with fixture events, including a replayed event.

**T3.4 — Checkout actions**: `actions/payments/create-checkout-session.ts` takes the active org, requires owner/admin, rejects Free, customer on the org, `metadata.organizationId`; new `create-credit-purchase.ts` (packs from spec 4.2); billing portal action uses the org customer.

**T3.5 — Cron** `app/api/cron/credits/route.ts`: Bearer `CRON_SECRET` (constant-time compare), runs `runDueResets` + `expirePurchases`, returns counts. Add `CRON_SECRET` to env docs and the deploy scheduler note.

## Phase 4 — Frontend (`lib/billing/`)

**T4.1** — `use-credits.ts`, `use-plan-limits.ts` (api client + `credits:changed` event); server actions `get-wallet`, `get-plan-limits`, `list-credit-transactions`.
**T4.2** — `CreditBalanceBadge` in the app shell next to `organization-switcher.tsx`.
**T4.3** — Billing page: usage, history, top-up modal (extend the existing billing page found in `app/(protected)`).
**T4.4** — `CreditCostBadge` on AI buttons; 402 handling → toast with "Buy credits" action.
**T4.5** — `UpgradeGate` on project creation and member invite.
**T4.6** — Pricing page: 4 tiers, monthly/yearly toggle, current plan badge.

## Out of scope
`/api/seq/*` (no routes), `storage_per_gb` / `max_storage_gb` (no storage accounting), `api_access` enforcement (no API-key metering yet).
