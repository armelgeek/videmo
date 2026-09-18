import { getActivePlans } from "@/actions/payments/get-plans";
import { getUserSubscription } from "@/actions/payments/get-user-subscription";
import { PricingCards } from '@/components/molecules/cards/pricing-cards';

interface PricingSectionProps {
  isLoggedIn: boolean;
}

export const PricingSection = async ({ isLoggedIn }: PricingSectionProps) => {
  const { plans } = await getActivePlans();

  if (!plans || plans.length === 0) {
    return null;
  }

  let currentPlanId: string | null = null;
  if (isLoggedIn) {
    const result = await getUserSubscription();
    if ("subscription" in result && result.subscription) {
      currentPlanId = result.subscription.planId;
    }
  }

  return (
    <section id="pricing" className="w-full py-20 border-t">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12 animate-fade-in-up">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Choose Your Plan
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free with enough credits for your first video. Upgrade when your team needs more.
          </p>
        </div>

        <div className="mt-12">
          <PricingCards
            plans={plans}
            isLoggedIn={isLoggedIn}
            currentPlanId={currentPlanId}
            hasSubscription={currentPlanId !== null}
          />
        </div>
      </div>
    </section>
  );
};
