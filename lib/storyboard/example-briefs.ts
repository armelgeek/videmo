/**
 * Briefs a first-time account can generate from without writing anything.
 *
 * Offered in the wizard, and linked to from the entry points, so the first
 * thing a new account sees the product do is a real script on a real brief
 * rather than an empty box.
 */
export const EXAMPLE_BRIEFS = [
  {
    key: "billing",
    label: "New billing, 90s",
    text: "Introduce our new billing in 90 seconds: the problem, one-click export, and what it changes for the finance team.",
  },
  {
    key: "onboarding",
    label: "Onboarding in 3 steps",
    text: "Show new users how onboarding works in 3 simple steps.",
  },
  {
    key: "teaser",
    label: "v2 launch teaser",
    text: "A LinkedIn teaser for our v2 launch: what's new for customers.",
  },
] as const;

/** The one an entry point links to when it does not name a brief. */
export const FEATURED_EXAMPLE = EXAMPLE_BRIEFS[1];

export function exampleBriefText(key: string | null | undefined): string | null {
  if (!key) return null;
  return EXAMPLE_BRIEFS.find((example) => example.key === key)?.text ?? null;
}
