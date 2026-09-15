export const QUOTA_KEYS = [
  "monthly_credits",
  "max_projects",
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
    description: "Get started for free",
    prices: { month: 0 },
    isPopular: false,
    displayFeatures: ["50 credits / month", "3 projects", "720p export", "Watermarked videos"],
    quotas: {
      monthly_credits: 50,
      max_projects: 3,
      max_video_duration_sec: 60,
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
    description: "Perfect for individuals and small projects",
    prices: { month: 999, year: 9999 },
    isPopular: false,
    displayFeatures: ["200 credits / month", "20 projects", "1080p export", "5 min videos"],
    quotas: {
      monthly_credits: 200,
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
    description: "For creators and growing teams",
    prices: { month: 2999, year: 29999 },
    isPopular: true,
    displayFeatures: [
      "1,000 credits / month",
      "Unlimited projects",
      "No watermark",
      "Premium templates",
      "Up to 5 team members",
      "API access",
      "Priority support",
    ],
    quotas: {
      monthly_credits: 1000,
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
    description: "For large organizations with advanced needs",
    prices: { month: 9999, year: 99999 },
    isPopular: false,
    displayFeatures: [
      "5,000 credits / month",
      "Everything in Pro",
      "4K export",
      "30 min videos",
      "Custom branding",
      "Unlimited team members",
    ],
    quotas: {
      monthly_credits: 5000,
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
  { action: "generate_image", cost: 8, label: "AI image" },
  { action: "generate_narration", cost: 15, label: "AI narration" },
] as const;
export type CreditAction = (typeof CREDIT_ACTION_COSTS)[number]["action"];

export const CREDIT_PACKS = {
  small: { credits: 100, amount: 499, label: "100 credits" },
  medium: { credits: 300, amount: 1299, label: "300 credits" },
  large: { credits: 1000, amount: 3999, label: "1,000 credits" },
} as const;
export type CreditPackId = keyof typeof CREDIT_PACKS;

export const PURCHASED_CREDITS_VALIDITY_MONTHS = 12;

export function getTierDefinition(tier: string): TierDefinition | undefined {
  return TIER_CATALOG.find((definition) => definition.tier === tier);
}

// Stand-in price ids until setup:stripe-plans creates the real Stripe prices.
export function placeholderPriceId(tier: Tier, interval: BillingInterval): string {
  if (tier === "free") return FREE_PRICE_ID;
  return `price_${tier}_${interval}ly`;
}
