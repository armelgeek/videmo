export class InsufficientCreditsError extends Error {
  constructor(
    readonly balance: number,
    readonly required: number,
  ) {
    super(`Insufficient credits: ${balance} available, ${required} required`);
    this.name = "InsufficientCreditsError";
  }
}

export class QuotaExceededError extends Error {
  constructor(
    readonly quotaKey: string,
    readonly limit: number,
    readonly current: number,
  ) {
    super(`Quota "${quotaKey}" exceeded: ${current}/${limit}`);
    this.name = "QuotaExceededError";
  }
}

export class FeatureNotAvailableError extends Error {
  constructor(
    readonly feature: string,
    readonly tier: string,
  ) {
    super(`Feature "${feature}" is not available on the ${tier} plan`);
    this.name = "FeatureNotAvailableError";
  }
}

export class UnknownCreditActionError extends Error {
  constructor(readonly action: string) {
    super(`No credit cost configured for action "${action}" — run seed:plans`);
    this.name = "UnknownCreditActionError";
  }
}
