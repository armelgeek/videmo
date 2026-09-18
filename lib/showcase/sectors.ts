export const SHOWCASE_SECTORS = {
  saas: "SaaS & Tech",
  education: "Education & Training",
  marketing: "Marketing & Ads",
  healthcare: "Healthcare",
  finance: "Finance & Insurance",
  hr: "HR & Onboarding",
  ecommerce: "E-commerce & Retail",
  "real-estate": "Real estate",
  nonprofit: "Non-profit & Public",
} as const;

export type ShowcaseSector = keyof typeof SHOWCASE_SECTORS;

export const SHOWCASE_SECTOR_IDS = Object.keys(SHOWCASE_SECTORS) as ShowcaseSector[];

export function sectorLabel(sector: string): string {
  return SHOWCASE_SECTORS[sector as ShowcaseSector] ?? sector;
}
