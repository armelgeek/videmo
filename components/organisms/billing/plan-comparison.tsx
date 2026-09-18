import { Check, Minus } from "lucide-react";
import { FREE_ANIMATION_STYLES } from "@/lib/whiteboard-animation/style-tiers";
import { TIER_CATALOG, type TierDefinition, UNLIMITED, videoMinutesFor } from "@/lib/billing/catalog";

type Cell = string | boolean;

const count = (value: number, unit = "") =>
  value === UNLIMITED ? "Unlimited" : `${value.toLocaleString("en-US")}${unit}`;

const duration = (seconds: number) =>
  seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;

const ROWS: { label: string; value: (t: TierDefinition) => Cell }[] = [
  { label: "Monthly credits", value: (t) => count(t.quotas.monthly_credits) },
  { label: "One-minute videos / month", value: (t) => `≈ ${videoMinutesFor(t.quotas.monthly_credits)}` },
  {
    label: "Drawing styles",
    value: (t) => (t.features.premium_templates ? "All 12" : String(FREE_ANIMATION_STYLES.length)),
  },
  { label: "Projects", value: (t) => count(t.quotas.max_projects) },
  { label: "Longest video", value: (t) => duration(t.quotas.max_video_duration_sec) },
  {
    label: "Export quality",
    value: (t) => (t.quotas.max_export_resolution >= 2160 ? "4K" : `${t.quotas.max_export_resolution}p`),
  },
  { label: "No watermark", value: (t) => t.features.remove_watermark },
  { label: "Team members", value: (t) => count(t.quotas.max_org_members) },
  { label: "Organizations", value: (t) => count(t.quotas.max_organizations) },
  { label: "Storage", value: (t) => count(t.quotas.max_storage_gb, " GB") },
  { label: "API access", value: (t) => t.features.api_access },
  { label: "Custom branding (logo)", value: (t) => t.features.custom_branding },
  { label: "Priority support", value: (t) => t.features.priority_support },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-primary" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" aria-label="Not included" />;
  return <span className="text-xs font-medium text-foreground">{value}</span>;
}

export function PlanComparison({ showTitle = true }: { showTitle?: boolean }) {
  return (
    <section className="space-y-4">
      {showTitle && (
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            <span className="sk-marker">Feature Comparison</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Detailed breakdown of features, limits and capabilities across all plans.
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border-2 border-ink bg-card shadow-[5px_5px_0_hsl(var(--offset))]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-2 border-ink bg-muted/40">
              <th scope="col" className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Feature
              </th>
              {TIER_CATALOG.map((t) => (
                <th
                  key={t.tier}
                  scope="col"
                  className={
                    t.isPopular
                      ? "bg-highlight/20 px-5 py-3.5 text-center text-xs font-bold text-foreground"
                      : "px-5 py-3.5 text-center text-xs font-semibold text-muted-foreground"
                  }
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{t.name}</span>
                    {t.isPopular && (
                      <span className="text-[10px] font-bold text-foreground">Popular</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {ROWS.map((row) => (
              <tr key={row.label} className="transition-colors hover:bg-muted/15">
                <th scope="row" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">
                  {row.label}
                </th>
                {TIER_CATALOG.map((t) => (
                  <td
                    key={t.tier}
                    className={
                      t.isPopular
                        ? "bg-primary/5 px-5 py-3 text-center tabular-nums"
                        : "px-5 py-3 text-center tabular-nums"
                    }
                  >
                    <CellValue value={row.value(t)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
