export const PAID_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export function isPaidStatus(status: string): boolean {
  return (PAID_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

// Clamps to the last day so Jan 31 + 1 month is Feb 28/29, not Mar 3.
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

// Monthly credit resets are independent of the billing interval, so a yearly
// period end is only used when it falls within the first month.
export function initialResetAt(now: Date, periodEnd?: Date | null): Date {
  const nextMonth = addMonths(now, 1);
  if (periodEnd && periodEnd > now && periodEnd < nextMonth) return periodEnd;
  return nextMonth;
}
