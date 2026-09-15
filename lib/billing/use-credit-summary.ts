"use client";

import { useCallback, useEffect, useState } from "react";
import { type CreditSummary, getCreditSummary } from "@/actions/billing/get-credit-summary";
import { ORGANIZATION_CHANGED_EVENT } from "@/lib/app-shell/organization-events";
import { CREDITS_CHANGED_EVENT } from "./billing-notice";

type SummaryResult = Awaited<ReturnType<typeof getCreditSummary>>;

export function useCreditSummary() {
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((result: SummaryResult) => {
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setSummary(result.summary);
  }, []);

  const refresh = useCallback(() => getCreditSummary().then(apply), [apply]);

  useEffect(() => {
    // A response landing after unmount or an org switch must not overwrite newer state.
    let active = true;
    const load = () =>
      getCreditSummary().then((result) => {
        if (active) apply(result);
      });

    void load();
    const events = [CREDITS_CHANGED_EVENT, ORGANIZATION_CHANGED_EVENT];
    for (const event of events) window.addEventListener(event, load);
    return () => {
      active = false;
      for (const event of events) window.removeEventListener(event, load);
    };
  }, [apply]);

  return { summary, error, refresh };
}
