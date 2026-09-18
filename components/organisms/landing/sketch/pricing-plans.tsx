"use client";

import Link from "next/link";
import { useState } from "react";
import { type BillingInterval, TIER_CATALOG } from "@/lib/billing/catalog";

const PLAN_CTA = {
  free: "Start free",
  starter: "Get started",
  pro: "Choose Pro",
  enterprise: "Talk to us",
} as const;

const planHref = (tier: string, interval: BillingInterval) => {
  if (tier === "enterprise") return "/contact";
  if (tier === "free") return "/signup";
  const target = `/billing?interval=${interval === "year" ? "yearly" : "monthly"}#plans`;
  return `/signup?redirect=${encodeURIComponent(target)}`;
};

const money = (cents: number) =>
  cents === 0 ? "$0" : `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

const yearlySavingPct = (monthly: number, yearly: number) =>
  Math.round((1 - yearly / (monthly * 12)) * 100);

const bestSaving = Math.max(
  ...TIER_CATALOG.filter((p) => p.prices.month && p.prices.year).map((p) =>
    yearlySavingPct(p.prices.month as number, p.prices.year as number),
  ),
);

export function PricingPlans() {
  const [interval, setBillingInterval] = useState<BillingInterval>("month");

  return (
    <>
      <div className="billing-switch" role="radiogroup" aria-label="Billing period">
        {(["month", "year"] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={interval === i}
            className={`billing-option ${interval === i ? "is-on" : ""}`}
            onClick={() => setBillingInterval(i)}
          >
            {i === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
        <span className="sk-hand billing-save">save up to {bestSaving}% ↙</span>
      </div>

      <div className="plans">
        {TIER_CATALOG.map((p) => {
          const monthly = p.prices.month ?? 0;
          const yearly = p.prices.year;
          const showYearly = interval === "year" && yearly !== undefined;
          const perMonth = showYearly ? yearly / 12 : monthly;

          return (
            <div key={p.tier} className={`plan ${p.isPopular ? "is-pick" : ""}`}>
              {p.isPopular && <span className="shot-tape" aria-hidden="true" />}
              {p.isPopular && <span className="plan-flag sk-hand">most popular</span>}
              <h3>{p.name}</h3>
              <p className="plan-price">
                <span className="sk-display">{money(Math.round(perMonth))}</span>
                <span className="plan-per">/ month</span>
              </p>
              <p className="plan-billed">
                {monthly === 0
                  ? "Free forever"
                  : showYearly
                    ? `${money(yearly)} billed yearly · save ${yearlySavingPct(monthly, yearly)}%`
                    : "Billed monthly"}
              </p>
              <p className="plan-note">{p.description}</p>
              <ul className="plan-items">
                {p.displayFeatures.map((it) => (
                  <li key={it}>
                    <span className="sk-hand" aria-hidden="true">✓</span>
                    {it}
                  </li>
                ))}
              </ul>
              <Link
                href={planHref(p.tier, interval)}
                className={`sk-btn ${p.isPopular ? "sk-btn-main" : ""}`}
                style={{ justifyContent: "center" }}
              >
                {PLAN_CTA[p.tier]}
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
