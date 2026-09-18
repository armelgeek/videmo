export const QUOTA_KEYS = [
  "monthly_credits",
  "max_projects",
  "max_organizations",
  "max_video_duration_sec",
  "max_export_resolution",
  "max_org_members",
  "max_storage_gb",
] as const;
export type QuotaKey = (typeof QUOTA_KEYS)[number];

export const FEATURE_KEYS = [
  "premium_templates",
  "custom_branding",
  "remove_watermark",
  "api_access",
  "priority_support",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const TIERS = ["free", "starter", "pro", "enterprise"] as const;
export type Tier = (typeof TIERS)[number];

export type BillingInterval = "month" | "year";

export const UNLIMITED = -1;

// Credit costs are set so that one minute of video (~6 scenes of 10 s) spends about this much.
export const CREDITS_PER_VIDEO_MINUTE = 100;

export function videoMinutesFor(credits: number): number {
  return Math.floor(credits / CREDITS_PER_VIDEO_MINUTE);
}

function creditsLine(credits: number): string {
  return `${credits.toLocaleString("en-US")} credits / month`;
}
export const FREE_PRICE_ID = "free_forever";

export interface TierDefinition {
  tier: Tier;
  name: string;
  description: string;
  prices: Partial<Record<BillingInterval, number>>;
  isPopular: boolean;
  displayFeatures: string[];
  quotas: Record<QuotaKey, number>;
  features: Record<FeatureKey, boolean>;
}

export const TIER_CATALOG: readonly TierDefinition[] = [
  {
    tier: "free",
    name: "Free",
    description: "Try it on a real video",
    prices: { month: 0 },
    isPopular: false,
    displayFeatures: [
      creditsLine(100),
      "4 drawing styles",
      "3 projects",
      "720p export, videos up to 90 s",
      "Watermark on exports",
    ],
    quotas: {
      monthly_credits: 100,
      max_organizations: 1,
      max_projects: 3,
      max_video_duration_sec: 90,
      max_export_resolution: 720,
      max_org_members: 1,
      max_storage_gb: 1,
    },
    features: {
      premium_templates: false,
      custom_branding: false,
      remove_watermark: false,
      api_access: false,
      priority_support: false,
    },
  },
  {
    tier: "starter",
    name: "Starter",
    description: "For solo creators who publish every week",
    prices: { month: 1200, year: 12000 },
    isPopular: false,
    displayFeatures: [
      creditsLine(600),
      "4 drawing styles",
      "20 projects",
      "1080p export, videos up to 5 min",
      "Watermark on exports",
    ],
    quotas: {
      monthly_credits: 600,
      max_organizations: 1,
      max_projects: 20,
      max_video_duration_sec: 300,
      max_export_resolution: 1080,
      max_org_members: 1,
      max_storage_gb: 5,
    },
    features: {
      premium_templates: false,
      custom_branding: false,
      remove_watermark: false,
      api_access: false,
      priority_support: false,
    },
  },
  {
    tier: "pro",
    name: "Pro",
    description: "For marketing teams that publish a lot",
    prices: { month: 3900, year: 39000 },
    isPopular: true,
    displayFeatures: [
      creditsLine(2500),
      "All 12 drawing styles",
      "Unlimited projects",
      "1080p export, videos up to 10 min",
      "No watermark",
      "5 members, 3 organizations",
      "API access",
      "Priority support",
    ],
    quotas: {
      monthly_credits: 2500,
      max_organizations: 3,
      max_projects: UNLIMITED,
      max_video_duration_sec: 600,
      max_export_resolution: 1080,
      max_org_members: 5,
      max_storage_gb: 50,
    },
    features: {
      premium_templates: true,
      custom_branding: false,
      remove_watermark: true,
      api_access: true,
      priority_support: true,
    },
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    description: "For agencies and large teams",
    prices: { month: 9900, year: 99000 },
    isPopular: false,
    displayFeatures: [
      creditsLine(7000),
      "Everything in Pro",
      "4K export, videos up to 30 min",
      "Your logo on every video",
      "Unlimited members and organizations",
      "Unlimited storage",
    ],
    quotas: {
      monthly_credits: 7000,
      max_organizations: UNLIMITED,
      max_projects: UNLIMITED,
      max_video_duration_sec: 1800,
      max_export_resolution: 2160,
      max_org_members: UNLIMITED,
      max_storage_gb: UNLIMITED,
    },
    features: {
      premium_templates: true,
      custom_branding: true,
      remove_watermark: true,
      api_access: true,
      priority_support: true,
    },
  },
];

export const CREDIT_ACTION_COSTS = [
  { action: "generate_script", cost: 5, label: "AI script" },
  { action: "generate_storyboard", cost: 10, label: "AI storyboard" },
  { action: "generate_image", cost: 12, label: "AI image" },
  { action: "generate_narration", cost: 2, label: "AI narration" },
] as const;
export type CreditAction = (typeof CREDIT_ACTION_COSTS)[number]["action"];

export const CREDIT_PACKS = {
  small: { credits: 100, amount: 499, label: "100 credits" },
  medium: { credits: 300, amount: 1299, label: "300 credits" },
  large: { credits: 1000, amount: 3999, label: "1,000 credits" },
} as const;
export type CreditPackId = keyof typeof CREDIT_PACKS;

// Own keys only: "toString" must not resolve to a pack.
export function findCreditPack(packId: unknown) {
  if (typeof packId !== "string" || !Object.hasOwn(CREDIT_PACKS, packId)) return null;
  const id = packId as CreditPackId;
  return { id, ...CREDIT_PACKS[id] };
}

export const PURCHASED_CREDITS_VALIDITY_MONTHS = 12;

export function getTierDefinition(tier: string): TierDefinition | undefined {
  return TIER_CATALOG.find((definition) => definition.tier === tier);
}

// Stand-in price ids until setup:stripe-plans creates the real Stripe prices.
export function placeholderPriceId(tier: Tier, interval: BillingInterval): string {
  if (tier === "free") return FREE_PRICE_ID;
  return `price_${tier}_${interval}ly`;
}
