const DAY_MS = 24 * 60 * 60 * 1000;

export const ONBOARDING_STEPS = [
  { step: 1, afterDays: 1 },
  { step: 2, afterDays: 3 },
  { step: 3, afterDays: 6 },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]["step"];

export function onboardingSchedule(verifiedAt: Date): { kind: string; sendAt: Date }[] {
  return ONBOARDING_STEPS.map(({ step, afterDays }) => ({
    kind: `onboarding:${step}`,
    sendAt: new Date(verifiedAt.getTime() + afterDays * DAY_MS),
  }));
}

export function previousMonthKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(key: string): { start: Date; end: Date } {
  const [year, month] = key.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export type ParsedKind =
  | { type: "onboarding"; step: OnboardingStep }
  | { type: "digest"; month: string }
  | null;

export function parseKind(kind: string): ParsedKind {
  const [type, value] = kind.split(":");
  if (type === "onboarding") {
    const step = Number(value);
    return ONBOARDING_STEPS.some((s) => s.step === step) ? { type, step: step as OnboardingStep } : null;
  }
  if (type === "digest" && /^\d{4}-\d{2}$/.test(value ?? "")) return { type, month: value };
  return null;
}
