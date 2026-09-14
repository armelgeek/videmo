export const PLANS = [
  { name: "Starter", monthly: 29, note: "To publish your first videos.", items: ["Script → AI storyboard", "Hand-drawn animation", "Synced voiceover", "Export 16:9, 9:16, 1:1"], cta: "Get started", pick: false },
  { name: "Professional", monthly: 79, note: "For marketing teams that publish every week.", items: ["Everything in Starter", "Unlimited projects", "Shared team workspace", "Roles and edit lock"], cta: "Choose Professional", pick: true },
  { name: "Enterprise", monthly: 299, note: "For agencies managing several clients.", items: ["Everything in Professional", "Multiple client workspaces", "Dedicated support", "Onboarding assistance"], cta: "Talk to us", pick: false },
] as const;

export const TEAM_PLAN = PLANS[1];
