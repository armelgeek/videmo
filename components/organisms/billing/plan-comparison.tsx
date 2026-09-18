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
  { label: "Your logo on videos", value: (t) => t.features.custom_branding },
  { label: "Priority support", value: (t) => t.features.priority_support },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto h-4 w-4" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Not included" />;
  return <>{value}</>;
}

export function PlanComparison({ showTitle = true }: { showTitle?: boolean }) {
  return (
    <section className="space-y-4">
      {showTitle && <h2 className="text-xl font-extrabold text-foreground">Compare plans</h2>}
      <div className="overflow-x-auto rounded-lg border-2 border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-2 border-border">
              <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                <span className="sr-only">Feature</span>
              </th>
              {TIER_CATALOG.map((t) => (
                <th
                  key={t.tier}
                  scope="col"
                  className={t.isPopular ? "bg-highlight/25 px-4 py-3 text-center font-bold" : "px-4 py-3 text-center font-bold"}
                >
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {row.label}
                </th>
                {TIER_CATALOG.map((t) => (
                  <td
                    key={t.tier}
                    className={t.isPopular ? "bg-highlight/10 px-4 py-2.5 text-center tabular-nums" : "px-4 py-2.5 text-center tabular-nums"}
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
