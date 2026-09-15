import type Stripe from "stripe";
import { stripe } from "./config";
import { prisma } from "@/lib/prisma";

export interface OrganizationCustomerOwner {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

type CreateCustomer = (params: Stripe.CustomerCreateParams) => Promise<{ id: string }>;

// Concurrent callers race to fill the null column; every caller returns the stored winner.
async function claimCustomer(organizationId: string, customerId: string): Promise<string> {
  await prisma.organization.updateMany({
    where: { id: organizationId, stripeCustomerId: null },
    data: { stripeCustomerId: customerId },
  });
  const { stripeCustomerId } = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });
  return stripeCustomerId ?? customerId;
}

export const createOrRetrieveOrganizationCustomer = async (
  owner: OrganizationCustomerOwner,
  createCustomer: CreateCustomer = (params) => stripe.customers.create(params),
): Promise<string> => {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: owner.organizationId },
    select: { stripeCustomerId: true, slug: true },
  });
  if (organization.stripeCustomerId) return organization.stripeCustomerId;

  // A personal workspace inherits the customer its owner paid with before billing moved to organizations.
  if (organization.slug === `personal-${owner.userId}`) {
    const user = await prisma.user.findUnique({
      where: { id: owner.userId },
      select: { stripeCustomerId: true },
    });
    if (user?.stripeCustomerId) {
      const holder = await prisma.organization.findFirst({
        where: { stripeCustomerId: user.stripeCustomerId },
        select: { id: true },
      });
      if (!holder) return claimCustomer(owner.organizationId, user.stripeCustomerId);
    }
  }

  const customer = await createCustomer({
    email: owner.email,
    name: owner.organizationName,
    metadata: { organizationId: owner.organizationId, userId: owner.userId },
  });
  return claimCustomer(owner.organizationId, customer.id);
};

export const formatAmount = (amount: number, currency: string = "usd"): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
};

export const getInterval = (interval: string): string => {
  return interval === "month" ? "mo" : "yr";
};
