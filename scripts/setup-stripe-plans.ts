import "dotenv/config";
import {
  type BillingInterval,
  TIER_CATALOG,
  getTierDefinition,
  placeholderPriceId,
} from "@/lib/billing/catalog";
import {
  backfillLegacyTiers,
  findTierPlan,
  syncActionCosts,
  upsertTierPlan,
} from "@/lib/billing/sync-catalog";
import { db } from "@/lib/db";
import { stripe } from "@/lib/payments/stripe/config";

function isRealStripeId(id: string | undefined, placeholder: string): id is string {
  return !!id && id !== placeholder;
}

async function setupStripePlans() {
  console.log("🔄 Setting up Stripe plans...\n");
  await backfillLegacyTiers(db);

  const free = getTierDefinition("free");
  if (free) await upsertTierPlan(db, free, "month");

  let failures = 0;

  for (const definition of TIER_CATALOG.filter((t) => t.tier !== "free")) {
    try {
      const intervals = Object.keys(definition.prices) as BillingInterval[];
      const existingRows = await Promise.all(
        intervals.map((interval) => findTierPlan(db, definition.tier, interval)),
      );

      let productId = existingRows
        .map((row) => row?.stripeProductId)
        .find((id) => isRealStripeId(id, `prod_${definition.tier}`));

      for (const [index, interval] of intervals.entries()) {
        const existing = existingRows[index];
        const placeholder = placeholderPriceId(definition.tier, interval);

        // Re-running must not create duplicate Stripe prices. Stripe prices are immutable, so a new
        // amount needs a new price; current subscribers keep the old one until they change plan.
        const amountUnchanged = existing?.amount === definition.prices[interval];
        if (isRealStripeId(existing?.stripePriceId, placeholder) && amountUnchanged) {
          console.log(`⏭️  ${definition.name} (${interval}) already linked: ${existing?.stripePriceId}`);
          await upsertTierPlan(db, definition, interval);
          continue;
        }

        if (!productId) {
          const product = await stripe.products.create({
            name: definition.name,
            description: definition.description,
            metadata: { tier: definition.tier },
          });
          productId = product.id;
          console.log(`📦 Product created for ${definition.name}: ${product.id}`);
        }

        if (isRealStripeId(existing?.stripePriceId, placeholder)) {
          console.log(`🔁 ${definition.name} (${interval}) amount changed: ${existing?.amount} → ${definition.prices[interval]}`);
        }

        const price = await stripe.prices.create({
          product: productId,
          unit_amount: definition.prices[interval],
          currency: "usd",
          recurring: { interval, interval_count: 1 },
          metadata: { tier: definition.tier },
        });
        console.log(`💰 ${definition.name} (${interval}) price: ${price.id}`);

        await upsertTierPlan(db, definition, interval, { priceId: price.id, productId });
      }
    } catch (error) {
      failures++;
      console.error(`❌ Error setting up ${definition.name}:`, error);
    }
  }

  await syncActionCosts(db);

  if (failures > 0) {
    console.error(`\n⚠️  ${failures} tier(s) failed.`);
    process.exit(1);
  }
  console.log("\n✨ Stripe plans setup complete!");
}

setupStripePlans()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
