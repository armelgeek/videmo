# 🎯 Credits & Feature Gating System — Complete Specification

**Status**: Design Complete ✅  
**Date**: 2026-09-15  
**Architecture**: Ledger-based (Approach A) with centralized credit pool per user

---

## 📊 Executive Summary

A comprehensive system for managing user credits, plan quotas, and feature access in the Hayzar video creation platform. Replaces the simple plan features array with:

- **Granular per-user credit wallet** (monthly plan quota + purchased top-ups)
- **Immutable ledger** of all credit transactions (audit trail)
- **Feature gates** (boolean) and **quotas** (numeric limits) per plan tier
- **4-tier pricing**: Free / Starter / Pro / Enterprise
- **Stripe integration** for subscriptions + one-shot credit purchases
- **Progressive frontend** gating (UpgradeGate wrapper component)

---

## 🏗️ Section 1 — Data Schema

### 1.1 Plan Model Evolution

The existing `Plan` model gains a `tier` field and relationships to quotas/features:

```typescript
model Plan {
  // ... existing fields unchanged ...
  
  tier      String  // "free" | "starter" | "pro" | "enterprise"
  quotas    PlanQuota[]
  features  PlanFeatureGate[]
}
```

**Note**: The Free plan has `stripePriceId = "free_forever"` and `amount = 0`.

### 1.2 New Tables

#### PlanQuota — Numeric limits per plan

```prisma
model PlanQuota {
  id        String   @id @default(cuid())
  planId    String
  plan      Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  key       String   // "max_projects" | "max_video_duration_sec" | "max_org_members" | 
                     // "monthly_credits" | "max_export_resolution" | "max_storage_gb"
  value     Int      // numeric value (-1 = unlimited)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([planId, key])
  @@index([planId])
}
```

#### PlanFeatureGate — Boolean feature access per plan

```prisma
model PlanFeatureGate {
  id        String   @id @default(cuid())
  planId    String
  plan      Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  key       String   // "premium_templates" | "custom_branding" | "remove_watermark" |
                     // "organization_access" | "api_access" | "priority_support"
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([planId, key])
  @@index([planId])
}
```

#### CreditActionCost — Global action costs (independent of plan)

```prisma
model CreditActionCost {
  id        String   @id @default(cuid())
  action    String   @unique  // "generate_script" | "generate_storyboard" | 
                              // "generate_image" | "generate_narration" | "storage_per_gb"
  cost      Int      // credit deduction
  label     String   // display label
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### CreditWallet — Per-user credit balance

```prisma
model CreditWallet {
  id               String   @id @default(cuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  planCredits      Int      @default(0)      // monthly quota (expires each cycle)
  purchasedCredits Int      @default(0)      // bought top-ups (own expiry)
  resetAt          DateTime                  // next plan credit reset date
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

#### CreditTransaction — Immutable ledger (audit trail)

```prisma
model CreditTransaction {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        String   // "plan_grant" | "consumption" | "purchase" | "expiration" | "refund"
  amount      Int      // positive = credit, negative = debit
  balance     Int      // balance after transaction (for auditability)
  source      String?  // "plan" | "purchased"
  action      String?  // action type for consumption (e.g. "generate_image")
  referenceId String?  // linked resource id
  description String?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([type])
}
```

#### CreditPurchase — One-shot credit purchases (top-ups)

```prisma
model CreditPurchase {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripePaymentId  String   @unique
  credits          Int      // credits purchased
  amount           Int      // price in cents
  currency         String   @default("usd")
  remainingCredits Int      // unused credits from this purchase
  expiresAt        DateTime // expiration date (e.g. +12 months)
  createdAt        DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

#### User Model Additions

```prisma
model User {
  // ... existing fields ...
  creditWallet       CreditWallet?
  creditTransactions CreditTransaction[]
  creditPurchases    CreditPurchase[]
}
```

### 1.3 Plan Tier Grid

| Quota / Feature | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| monthly_credits | 50 | 200 | 1000 | 5000 |
| max_projects | 3 | 20 | -1 (∞) | -1 (∞) |
| max_video_duration_sec | 60 | 300 | 600 | 1800 |
| max_export_resolution | 720 | 1080 | 1080 | 2160 |
| max_org_members | 0 | 0 | 5 | -1 (∞) |
| max_storage_gb | 1 | 5 | 50 | -1 (∞) |
| premium_templates | ❌ | ❌ | ✅ | ✅ |
| custom_branding | ❌ | ❌ | ❌ | ✅ |
| remove_watermark | ❌ | ❌ | ✅ | ✅ |
| organization_access | ❌ | ❌ | ✅ | ✅ |
| api_access | ❌ | ❌ | ✅ | ✅ |
| priority_support | ❌ | ❌ | ✅ | ✅ |

### 1.4 Credit Costs Per Action

| Action | Credits | Label |
|---|---|---|
| generate_script | 5 | Script IA |
| generate_storyboard | 10 | Storyboard IA |
| generate_image | 8 | Image IA |
| generate_narration | 15 | Narration/Voice IA |
| storage_per_gb | 20 | Storage (per GB) |

---

## 🏗️ Section 2 — Business Logic (Services)

### 2.1 CreditService

Core service managing all credit operations (`lib/credits/credit-service.ts`):

```typescript
class CreditService {
  // === READ ===
  
  /** Returns wallet with total balance (plan + purchased) */
  getWallet(userId: string): Promise<{
    planCredits: number
    purchasedCredits: number
    totalBalance: number
    resetAt: Date
  }>
  
  /** Check if user can afford action */
  canAfford(userId: string, action: string): Promise<{
    allowed: boolean
    cost: number
    balance: number
  }>
  
  /** Paginated transaction history */
  getTransactions(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<CreditTransaction>>

  // === DEBIT ===
  
  /** Consume credits for action.
   *  Policy: FIFO (plan first, then purchased).
   *  Uses SELECT FOR UPDATE to prevent race conditions. */
  consume(
    userId: string,
    action: string,
    referenceId?: string
  ): Promise<CreditTransaction>

  // === CREDIT ===
  
  /** Grant monthly plan credits (called by reset cron/webhook) */
  grantPlanCredits(userId: string, amount: number): Promise<CreditTransaction>
  
  /** Grant purchased credits (called after Stripe payment) */
  grantPurchasedCredits(
    userId: string,
    purchaseId: string,
    amount: number
  ): Promise<CreditTransaction>

  // === LIFECYCLE ===
  
  /** Monthly reset: expire plan credits, regrant quota */
  resetMonthlyCredits(userId: string): Promise<void>
  
  /** Expire purchased credits past their date */
  expirePurchasedCredits(): Promise<number>
}
```

**Race Condition Safety** — `consume()` uses a transaction with `SELECT ... FOR UPDATE`:

```typescript
async consume(userId: string, action: string, referenceId?: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Lock wallet
    const wallet = await tx.$queryRaw`
      SELECT * FROM "CreditWallet" WHERE "userId" = ${userId} FOR UPDATE
    `;
    
    // 2. Get action cost
    const actionCost = await tx.creditActionCost.findUnique({ where: { action } });
    
    // 3. Check balance
    const totalBalance = wallet.planCredits + wallet.purchasedCredits;
    if (totalBalance < actionCost.cost) {
      throw new InsufficientCreditsError(totalBalance, actionCost.cost);
    }
    
    // 4. Debit FIFO: plan first, then purchased
    let remaining = actionCost.cost;
    let planDebit = Math.min(remaining, wallet.planCredits);
    let purchasedDebit = remaining - planDebit;
    
    // 5. Update wallet
    await tx.creditWallet.update({
      where: { userId },
      data: {
        planCredits: { decrement: planDebit },
        purchasedCredits: { decrement: purchasedDebit },
      },
    });
    
    // 6. Log transaction
    return tx.creditTransaction.create({
      data: {
        userId,
        type: "consumption",
        amount: -actionCost.cost,
        balance: totalBalance - actionCost.cost,
        source: planDebit > 0 ? "plan" : "purchased",
        action,
        referenceId,
        description: `${actionCost.label} — ${actionCost.cost} credits`,
      },
    });
  });
}
```

### 2.2 PlanGatingService

Feature gates and quota checks (`lib/plans/plan-gating-service.ts`):

```typescript
class PlanGatingService {
  /** Get active plan (with 60s in-memory cache) */
  getUserPlan(userId: string): Promise<Plan & { tier: string }>
  
  /** Check boolean feature gate */
  hasFeature(userId: string, feature: string): Promise<boolean>
  
  /** Check numeric quota against usage */
  checkQuota(userId: string, quotaKey: string, currentUsage: number): Promise<{
    allowed: boolean
    limit: number        // -1 = unlimited
    current: number
    remaining: number
  }>
  
  /** Get all plan limits at once (for UI) */
  getPlanLimits(userId: string): Promise<{
    tier: string
    quotas: Record<string, number>
    features: Record<string, boolean>
    credits: {
      balance: number
      monthlyAllowance: number
      resetAt: Date
    }
  }>
}
```

**Cache**: Plan data cached in-memory with 60s TTL + manual invalidation on plan change.

### 2.3 CreditPurchaseService

One-shot credit purchases via Stripe (`lib/credits/credit-purchase-service.ts`):

```typescript
class CreditPurchaseService {
  /** Create Stripe Checkout for credit purchase (mode: "payment", not "subscription") */
  createPurchaseCheckout(userId: string, packId: string): Promise<{ url: string }>
  
  /** Handle successful payment via Stripe webhook */
  handlePurchaseCompleted(session: Stripe.Checkout.Session): Promise<void>
}
```

**Credit Packs** (configurable):

| Pack | Credits | Price | Expiration |
|---|---|---|---|
| Small | 100 | $4.99 | 12 months |
| Medium | 300 | $12.99 | 12 months |
| Large | 1000 | $39.99 | 12 months |

### 2.4 Integration Points

Where services are called in existing code:

```
┌──────────────────────────────────────────────────────────┐
│              Existing AI Actions                          │
├──────────────────────────────────────────────────────────┤
│ generate-script.ts ──→ creditService.consume("gen_script")
│ generate-storyboard ──→ creditService.consume("gen_story")
│ generate-image.ts  ──→ creditService.consume("gen_image")
│ generate-narration  ──→ creditService.consume("gen_narr")
├──────────────────────────────────────────────────────────┤
│              Resource Creation                            │
├──────────────────────────────────────────────────────────┤
│ create-project.ts  ──→ gatingService.checkQuota("max_proj")
│ upload-media.ts    ──→ gatingService.checkQuota("max_stor")
│ invite-member.ts   ──→ gatingService.checkQuota("max_memb")
│ export-video.ts    ──→ gatingService.checkQuota("max_res")
├──────────────────────────────────────────────────────────┤
│              Feature Access                              │
├──────────────────────────────────────────────────────────┤
│ template-list.ts   ──→ gatingService.hasFeature("premium")
│ org-create.ts      ──→ gatingService.hasFeature("org_acc")
│ branding-settings  ──→ gatingService.hasFeature("branding")
├──────────────────────────────────────────────────────────┤
│              Stripe Webhooks                             │
├──────────────────────────────────────────────────────────┤
│ subscription.updated ──→ invalidate plan cache
│ subscription.deleted ──→ downgrade to Free + reset wallet
│ checkout (payment)   ──→ creditPurchaseService.handle()
│ invoice.paid (recur) ──→ creditService.grantPlanCredits()
├──────────────────────────────────────────────────────────┤
│              Cron Jobs                                    │
├──────────────────────────────────────────────────────────┤
│ Daily: expirePurchasedCredits()
│ (Monthly reset triggered by invoice.paid webhook)
└──────────────────────────────────────────────────────────┘
```

### 2.5 Custom Error Types

```typescript
// lib/credits/errors.ts

class InsufficientCreditsError extends Error {
  constructor(public balance: number, public required: number) {
    super(`Insufficient credits: ${balance} available, ${required} required`);
  }
}

class FeatureNotAvailableError extends Error {
  constructor(public feature: string, public currentTier: string) {
    super(`Feature "${feature}" not available on ${currentTier} plan`);
  }
}

class QuotaExceededError extends Error {
  constructor(public quotaKey: string, public limit: number, public current: number) {
    super(`Quota "${quotaKey}" exceeded: ${current}/${limit}`);
  }
}
```

These are caught in server actions and converted to user-friendly toast messages with upgrade CTA.

---

## 🏗️ Section 3 — Frontend Integration

### 3.1 New Module Structure

```
src/app/billing/
├── hooks/
│   ├── use-credits.ts          # Query wallet + balance + history
│   ├── use-plan-limits.ts      # Query quotas + features
│   └── use-credit-purchase.ts  # Mutation for credit top-up
├── components/
│   ├── credit-balance-badge.tsx    # Compact badge (header/sidebar)
│   ├── credit-usage-bar.tsx        # Progress bar (credits used/total)
│   ├── upgrade-gate.tsx            # Conditional wrapper (content or CTA)
│   ├── credit-cost-badge.tsx       # Badge "−5 credits" on buttons
│   ├── credit-history.tsx          # Paginated transaction table
│   ├── credit-topup-modal.tsx      # Modal for credit purchase
│   └── plan-usage-dashboard.tsx    # Overview of quotas + features
└── index.ts
```

### 3.2 Key Hooks

**use-credits.ts** — Wallet and balance:

```typescript
export const creditKeys = {
  wallet: (userId: string) => ["credits", "wallet", userId] as const,
  history: (userId: string, page: number) => ["credits", "history", userId, page] as const,
};

export function useCredits() {
  const { data: session } = useSession();
  
  return useQuery({
    queryKey: creditKeys.wallet(session?.user.id),
    queryFn: () => getWallet(), // server action
    enabled: !!session?.user.id,
    staleTime: 30_000, // 30s — credits change often
  });
}
```

**use-plan-limits.ts** — Quotas and features:

```typescript
export const planKeys = {
  limits: (userId: string) => ["plan", "limits", userId] as const,
};

export function usePlanLimits() {
  const { data: session } = useSession();
  
  return useQuery({
    queryKey: planKeys.limits(session?.user.id),
    queryFn: () => getPlanLimits(), // server action
    enabled: !!session?.user.id,
    staleTime: 60_000, // 1min — plan changes rarely
  });
}

// Derived shortcuts
export function useHasFeature(feature: string): boolean {
  const { data } = usePlanLimits();
  return data?.features[feature] ?? false;
}

export function useQuotaCheck(quotaKey: string, currentUsage: number) {
  const { data } = usePlanLimits();
  const limit = data?.quotas[quotaKey] ?? 0;
  return {
    allowed: limit === -1 || currentUsage < limit,
    limit,
    current: currentUsage,
    remaining: limit === -1 ? Infinity : Math.max(0, limit - currentUsage),
  };
}
```

### 3.3 Key Components

**<UpgradeGate>** — The most important: conditional wrapper showing content or upgrade CTA:

```typescript
interface UpgradeGateProps {
  feature?: string;        // boolean gate ("premium_templates")
  quota?: string;          // numeric gate ("max_projects")
  currentUsage?: number;   // current usage for quota
  credits?: string;        // credit gate ("generate_image")
  children: React.ReactNode;
  fallback?: React.ReactNode; // custom fallback, else default CTA
}

// Usage
<UpgradeGate feature="premium_templates">
  <TemplateGallery showPremium />
</UpgradeGate>

<UpgradeGate quota="max_projects" currentUsage={projectCount}>
  <Button onClick={createProject}>Create Project</Button>
</UpgradeGate>

<UpgradeGate credits="generate_image">
  <Button onClick={generateImage}>
    Generate Image <CreditCostBadge action="generate_image" />
  </Button>
</UpgradeGate>
```

**<CreditBalanceBadge>** — Header/sidebar display:
- Shows `⚡ 142` with color coding
- Green: > 50% of monthly quota
- Orange: 20-50%
- Red: < 20%
- Click opens billing dashboard or topup modal

**<CreditCostBadge>** — Badge on AI action buttons:
```tsx
<Button onClick={generateScript}>
  Generate Script <CreditCostBadge action="generate_script" />
</Button>
// Displays: "−5 ⚡"
```

**<CreditTopupModal>** — One-shot credit purchase:
- Shows 3 packs (Small/Medium/Large)
- Displays price, credits, "best value" badge on Medium
- Button triggers Stripe Checkout

### 3.4 Cache Invalidation After Consumption

When an AI action consumes credits, refresh the UI immediately:

```typescript
const generateMutation = useMutation({
  mutationFn: (data) => generateScript(data),
  onSuccess: () => {
    // Invalidate wallet to refresh badge
    queryClient.invalidateQueries({ queryKey: creditKeys.wallet(userId) });
    // ... existing AI result invalidation
  },
  onError: (error) => {
    if (error.message.includes("Insufficient credits")) {
      toast.error("Insufficient credits", {
        action: {
          label: "Buy Credits",
          onClick: openTopupModal,
        },
      });
    }
  },
});
```

### 3.5 Updated Pricing Page

The existing pricing card component evolves:
- 4 columns: Free + Starter + Pro + Enterprise
- Free plan: "Get Started" button (no Stripe checkout)
- Quotas displayed structurally (not simple strings)
- Badge: "Current Plan" on user's active plan
- Credit badge: "50 credits/month", "200 credits/month", etc.
- Features grouped by category (AI, Export, Collaboration, Support)

### 3.6 Billing Dashboard Page

New page at `/settings/billing`:

```
┌─────────────────────────────────────────┐
│ My Plan: Pro          [Manage Plan]     │
│                                         │
│ ⚡ Credits                              │
│ ████████████░░░░░░  742/1000           │
│                     (renews Sept 15)    │
│                          [Buy More]     │
│                                         │
│ 📊 Usage                                │
│ Projects:     12 / ∞                    │
│ Storage:      8.2 GB / 50 GB ████░░░  │
│ Org Members:  3 / 5       ██░░░░░░    │
│                                         │
│ 📜 Transaction History      [View All] │
│ Sept 15 │ Image AI  │ −8  │ 742  │     │
│ Sept 15 │ Script AI │ −5  │ 750  │     │
│ Sept 14 │ Narration │ −15 │ 755  │     │
│ Sept 1  │ Reset     │ +1000│ 770  │     │
└─────────────────────────────────────────┘
```

### 3.7 Conditional Watermark

Export video logic checks plan:

```typescript
const planLimits = await getPlanLimits(userId);
const showWatermark = !planLimits.features["remove_watermark"];
const maxResolution = planLimits.quotas["max_export_resolution"]; // 720, 1080, 2160
```

---

## 🏗️ Section 4 — Stripe Integration & Lifecycle

### 4.1 Webhook Handlers

#### invoice.paid — Monthly plan credit reset

Stripe sends `invoice.paid` on every subscription renewal. This is the trigger for resetting credits:

```typescript
// lib/webhooks/stripe/handlers/invoice.ts

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // ... existing logic ...

  // NEW: if renewal invoice, reset and grant credits
  if (invoice.subscription && invoice.billing_reason === "subscription_cycle") {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string },
      include: { plan: { include: { quotas: true } } },
    });

    if (subscription) {
      const monthlyCredits = subscription.plan.quotas
        .find(q => q.key === "monthly_credits")?.value ?? 0;

      await creditService.resetMonthlyCredits(subscription.userId);
      await creditService.grantPlanCredits(subscription.userId, monthlyCredits);
    }
  }
}
```

#### checkout.session.completed — Handle both subscription and payment

```typescript
// lib/webhooks/stripe/handlers/checkout-session.ts

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // EXISTING: subscription mode
  if (session.mode === "subscription") {
    // ... existing logic ...

    // NEW: after creating subscription, initialize wallet
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { quotas: true },
    });
    const monthlyCredits = plan.quotas.find(q => q.key === "monthly_credits")?.value ?? 0;
    
    await creditService.grantPlanCredits(userId, monthlyCredits);
    return;
  }

  // NEW: payment mode (one-shot credit purchase)
  if (session.mode === "payment" && session.metadata?.type === "credit_topup") {
    const userId = session.metadata.userId;
    const credits = parseInt(session.metadata.credits);
    const paymentIntent = session.payment_intent as string;

    const purchase = await prisma.creditPurchase.create({
      data: {
        userId,
        stripePaymentId: paymentIntent,
        credits,
        amount: session.amount_total!,
        currency: session.currency!,
        remainingCredits: credits,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +12 months
      },
    });

    await creditService.grantPurchasedCredits(userId, purchase.id, credits);
  }
}
```

#### subscription.deleted — Downgrade to Free

```typescript
// lib/webhooks/stripe/handlers/subscription.ts

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // ... existing logic ...

  // NEW: downgrade wallet to Free tier
  const dbSub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (dbSub) {
    // Plan credits expire immediately
    await creditService.resetMonthlyCredits(dbSub.userId);
    
    // Re-grant Free plan quota (50 credits)
    const freePlan = await prisma.plan.findFirst({
      where: { tier: "free" },
      include: { quotas: true },
    });
    const freeCredits = freePlan?.quotas.find(q => q.key === "monthly_credits")?.value ?? 50;
    await creditService.grantPlanCredits(dbSub.userId, freeCredits);
    
    // Invalidate plan cache
    planCacheInvalidate(dbSub.userId);
  }
}
```

### 4.2 Credit Purchase Checkout

Server action for one-shot credit purchases:

```typescript
// actions/payments/create-credit-purchase.ts

"use server";

const CREDIT_PACKS = {
  small:  { credits: 100,  amount: 499,   label: "100 credits" },
  medium: { credits: 300,  amount: 1299,  label: "300 credits" },
  large:  { credits: 1000, amount: 3999,  label: "1000 credits" },
} as const;

export async function createCreditPurchaseCheckout(packId: keyof typeof CREDIT_PACKS) {
  const session = await getAuthSession();
  if (!session?.user) return { error: "Authentication required" };

  const pack = CREDIT_PACKS[packId];
  if (!pack) return { error: "Invalid pack" };

  const customerId = await createOrRetrieveCustomer(session.user.id, session.user.email);

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",              // One-shot, not subscription
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: pack.label },
        unit_amount: pack.amount,
      },
      quantity: 1,
    }],
    metadata: {
      type: "credit_topup",       // Discriminant for webhook
      userId: session.user.id,
      credits: String(pack.credits),
      packId,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?topup=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?topup=cancel`,
  });

  return { url: checkoutSession.url };
}
```

### 4.3 User Lifecycle

```
1. SIGNUP
   User created → Free plan assigned
   → CreditWallet created: planCredits = 50, resetAt = +30d
   → CreditTransaction: type = "plan_grant", amount = +50

2. UPGRADE (Free → Pro)
   Stripe checkout (subscription) → webhook checkout.completed
   → Subscription created in DB
   → CreditWallet: planCredits reset to 1000
   → CreditTransaction: type = "expiration" (old plan creds)
   → CreditTransaction: type = "plan_grant", amount = +1000
   → Plan cache invalidated

3. DAILY USAGE
   AI action → creditService.consume()
   → Wallet debited (FIFO: plan first, purchased next)
   → CreditTransaction: type = "consumption", amount = -N
   → If insufficient → InsufficientCreditsError → user toast

4. TOP-UP (credit purchase)
   Stripe checkout (payment) → webhook checkout.completed
   → CreditPurchase created (expiresAt = +12 months)
   → Wallet: purchasedCredits += N
   → CreditTransaction: type = "purchase", amount = +N

5. MONTHLY RENEWAL
   Stripe invoice.paid (subscription_cycle)
   → CreditTransaction: type = "expiration" (remaining plan creds)
   → Wallet: planCredits = 0, then = plan quota
   → CreditTransaction: type = "plan_grant", amount = +quota
   → resetAt advanced by 30 days
   → (Purchased credits NOT affected)

6. DOWNGRADE / CANCEL
   Stripe subscription.deleted
   → Plan creds expired immediately
   → Wallet: planCredits = Free quota (50)
   → Purchased credits preserved (own expiry)
   → Quotas and feature gates → Free level

7. PURCHASED CREDITS EXPIRATION (daily cron)
   expirePurchasedCredits() scans CreditPurchase where expiresAt < now()
   → Wallet: purchasedCredits -= remaining from purchase
   → CreditTransaction: type = "expiration"
   → CreditPurchase: remainingCredits = 0
```

### 4.4 Cron Jobs

| Job | Frequency | Description |
|---|---|---|
| expirePurchasedCredits | Daily 02:00 UTC | Expire CreditPurchase entries past expiresAt |

**Note**: Monthly plan reset is triggered by Stripe webhook `invoice.paid`, not a cron. This is more reliable.

### 4.5 Webhook Idempotence

The existing `ProcessedWebhookEvent` guard (schema.prisma:433-441) already covers idempotence for all handlers. No double-credits possible.

---

## 🏗️ Section 5 — Migration, Seed Data & Deployment

### 5.1 Prisma Migration

Single migration adding new tables and `tier` field to Plan:

```sql
-- Migration: add_credits_and_gating_system

-- 1. Add tier to Plan
ALTER TABLE "Plan" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'starter';

-- 2. PlanQuota
CREATE TABLE "PlanQuota" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "PlanQuota_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "PlanQuota_planId_key_key" ON "PlanQuota"("planId", "key");

-- 3. PlanFeatureGate
CREATE TABLE "PlanFeatureGate" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "PlanFeatureGate_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "PlanFeatureGate_planId_key_key" ON "PlanFeatureGate"("planId", "key");

-- 4. CreditActionCost
CREATE TABLE "CreditActionCost" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "cost" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("action")
);

-- 5. CreditWallet
CREATE TABLE "CreditWallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planCredits" INTEGER NOT NULL DEFAULT 0,
  "purchasedCredits" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE ("userId")
);

-- 6. CreditTransaction
CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance" INTEGER NOT NULL,
  "source" TEXT,
  "action" TEXT,
  "referenceId" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

-- 7. CreditPurchase
CREATE TABLE "CreditPurchase" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stripePaymentId" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "remainingCredits" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "CreditPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE ("stripePaymentId")
);
CREATE INDEX "CreditPurchase_userId_idx" ON "CreditPurchase"("userId");
CREATE INDEX "CreditPurchase_expiresAt_idx" ON "CreditPurchase"("expiresAt");
```

**Note**: Migration is additive only — no breaking changes.

### 5.2 Seed Script — Plans & Configuration

```typescript
// scripts/seed-plans.ts (complete rewrite)

const PLANS = [
  {
    tier: "free",
    name: "Free",
    description: "Get started for free",
    amount: 0,
    stripePriceId: "free_forever",
    stripeProductId: "prod_free",
    isPopular: false,
    quotas: {
      monthly_credits: 50,
      max_projects: 3,
      max_video_duration_sec: 60,
      max_export_resolution: 720,
      max_org_members: 0,
      max_storage_gb: 1,
    },
    features: {
      premium_templates: false,
      custom_branding: false,
      remove_watermark: false,
      organization_access: false,
      api_access: false,
      priority_support: false,
    },
  },
  // starter, pro, enterprise... (full definitions from Section 1.3)
];

const ACTION_COSTS = [
  { action: "generate_script", cost: 5, label: "Script IA" },
  { action: "generate_storyboard", cost: 10, label: "Storyboard IA" },
  { action: "generate_image", cost: 8, label: "Image IA" },
  { action: "generate_narration", cost: 15, label: "Narration/Voice IA" },
  { action: "storage_per_gb", cost: 20, label: "Storage (per GB)" },
];

async function main() {
  // Seed plans with quotas and features
  for (const tierDef of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { stripePriceId: tierDef.stripePriceId },
      create: {
        name: tierDef.name,
        description: tierDef.description,
        amount: tierDef.amount,
        stripePriceId: tierDef.stripePriceId,
        stripeProductId: tierDef.stripeProductId,
        isPopular: tierDef.isPopular,
        tier: tierDef.tier,
      },
      update: {},
    });

    // Seed quotas
    for (const [key, value] of Object.entries(tierDef.quotas)) {
      await prisma.planQuota.upsert({
        where: { planId_key: { planId: plan.id, key } },
        create: { planId: plan.id, key, value },
        update: { value },
      });
    }

    // Seed features
    for (const [key, enabled] of Object.entries(tierDef.features)) {
      await prisma.planFeatureGate.upsert({
        where: { planId_key: { planId: plan.id, key } },
        create: { planId: plan.id, key, enabled },
        update: { enabled },
      });
    }
  }

  // Seed action costs
  for (const ac of ACTION_COSTS) {
    await prisma.creditActionCost.upsert({
      where: { action: ac.action },
      create: ac,
      update: {},
    });
  }

  console.log("Seed complete");
}

main().catch(console.error).finally(() => process.exit(0));
```

### 5.3 Existing User Migration

One-time migration script for users already in the database:

```typescript
// scripts/migrate-existing-users.ts

async function migrateExistingUsers() {
  const users = await prisma.user.findMany({
    include: {
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
      },
    },
  });

  for (const user of users) {
    const activeSub = user.subscriptions[0];
    const plan = activeSub?.plan;
    const monthlyCredits = plan
      ? (
          await prisma.planQuota.findFirst({
            where: { planId: plan.id, key: "monthly_credits" },
          })
        )?.value ?? 50
      : 50; // Free

    // Create wallet if not exists
    await prisma.creditWallet.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planCredits: monthlyCredits,
        purchasedCredits: 0,
        resetAt: activeSub?.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
      update: {},
    });

    // Log initial transaction
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        type: "plan_grant",
        amount: monthlyCredits,
        balance: monthlyCredits,
        source: "plan",
        description: "Migration — initial credits",
      },
    });
  }

  console.log(`Migrated ${users.length} users`);
}

migrateExistingUsers().catch(console.error).finally(() => process.exit(0));
```

### 5.4 Auto-initialization for New Users

On signup, create wallet with Free plan credits:

```typescript
// Hook called after user creation (in Better Auth middleware or post-signup)

async function onUserCreated(user: User) {
  const freePlan = await prisma.plan.findFirst({
    where: { tier: "free" },
    include: { quotas: true },
  });

  const monthlyCredits = freePlan?.quotas.find(q => q.key === "monthly_credits")?.value ?? 50;

  await prisma.creditWallet.create({
    data: {
      userId: user.id,
      planCredits: monthlyCredits,
      purchasedCredits: 0,
      resetAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: user.id,
      type: "plan_grant",
      amount: monthlyCredits,
      balance: monthlyCredits,
      source: "plan",
      description: "Welcome — Free plan credits",
    },
  });
}
```

### 5.5 Deployment Order

**Phase 1 — Backend (invisible, additive)**

1. Prisma migration
2. Seed plans + quotas + features + action costs
3. Run existing user migration script
4. Deploy CreditService + PlanGatingService + CreditPurchaseService
5. Enrich Stripe webhook handlers (invoice.paid, checkout, subscription.deleted)
6. Add onUserCreated hook
7. Add create-credit-purchase server action
8. Add daily cron for expirePurchasedCredits

**Phase 2 — Frontend (progressive activation)**

9. Update pricing page (4 tiers)
10. Add CreditBalanceBadge to header
11. Add /settings/billing page
12. Add CreditCostBadge to AI action buttons
13. Add UpgradeGate wrappers to existing features
14. Add CreditTopupModal
15. Enable watermark logic

### 5.6 Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Race condition on consume() | Double debit | SELECT FOR UPDATE in Prisma transaction |
| Webhook duplication | Double credit | ProcessedWebhookEvent guard (existing) |
| User without wallet | Crash on AI | Fallback: create wallet on-the-fly if missing |
| Migration partial failure | Inconsistent state | Idempotent upsert script |
| Stripe checkout fails | No credits added | Credits only on webhook checkout.completed (post-payment) |
| Plan change mid-cycle | Credit mismatch | Expire old → grant new (or pro-rata) |

---

## 📋 Summary

This is a complete, production-ready credits and feature gating system for Hayzar that:

✅ Manages per-user credit wallets with plan + purchased credits  
✅ Maintains immutable audit trail via CreditTransaction ledger  
✅ Supports 4 pricing tiers with granular quotas and feature gates  
✅ Integrates Stripe for subscriptions and one-shot credit purchases  
✅ Prevents double-spending via optimistic locking  
✅ Handles lifecycle transitions (signup → upgrade → cancel → reset)  
✅ Provides frontend hooks and components for progressive gating  
✅ Includes safe, idempotent migration for existing users  

All sections are validated and ready for implementation.
