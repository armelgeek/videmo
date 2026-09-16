export const PLANS = [
  {
    name: "Starter",
    monthly: 29,
    note: "To publish your first videos.",
    items: [
      "5 videos/month",
      "Script → AI storyboard",
      "3 animation styles (Sharpie, Chalk, Technical)",
      "Synced voiceover (5 languages)",
      "Export 16:9, 9:16, 1:1",
      "Watermark included"
    ],
    cta: "Get started",
    pick: false
  },
  {
    name: "Professional",
    monthly: 79,
    note: "For marketing teams that publish every week.",
    items: [
      "Unlimited videos",
      "Everything in Starter",
      "10+ animation styles",
      "Synced voiceover (45+ languages)",
      "Unlimited projects",
      "Shared team workspace",
      "Roles and edit lock",
      "No watermark"
    ],
    cta: "Choose Professional",
    pick: true
  },
  {
    name: "Enterprise",
    monthly: 299,
    note: "For agencies managing several clients.",
    items: [
      "Everything in Professional",
      "Multiple client workspaces",
      "Custom animation styles",
      "Batch processing",
      "API access",
      "Dedicated support",
      "Onboarding assistance",
      "Priority rendering"
    ],
    cta: "Talk to us",
    pick: false
  },
] as const;

export const TEAM_PLAN = PLANS[1];
