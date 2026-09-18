"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { cn } from "@/lib/utils";

const PANEL = "rounded-lg border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))]";

export function BrandLogoPanel({ organizationId, initialLogo }: { organizationId: string; initialLogo: string | null }) {
  const { summary } = useCreditSummary();
  const [logo, setLogo] = useState(initialLogo);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  if (!summary) return null;
  const included = summary.features.customBranding;

  const send = async (method: "POST" | "DELETE", file?: File) => {
    setBusy(true);
    try {
      const body = file ? new FormData() : undefined;
      if (file && body) body.append("file", file);
      const res = await fetch(`/api/organizations/${organizationId}/logo`, { method, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the logo");
      setLogo(data.logo);
      toast.success(data.logo ? "Logo saved. It now appears on your exports." : "Logo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the logo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className={cn(PANEL, "space-y-4")}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">Brand logo</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown in the corner of every exported video. PNG or JPEG, 1 MB max; a transparent PNG looks best.
        </p>
      </div>

      {!included ? (
        <p className="text-sm text-muted-foreground">
          Custom branding is part of the Enterprise plan.{" "}
          <Link href="/billing#plans" className="font-medium text-foreground underline">
            See plans
          </Link>
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-32 items-center justify-center rounded-md border border-dashed border-border bg-muted/40">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- bucket URL, not a Next image source
              <img src={logo} alt="Current brand logo" className="max-h-14 max-w-28 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              id="brand-logo-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void send("POST", file);
              }}
            />
            <label
              htmlFor="brand-logo-input"
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border-2 border-ink px-3 text-sm font-semibold",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
              {logo ? "Replace" : "Upload"}
            </label>
            {logo && (
              <button
                type="button"
                onClick={() => void send("DELETE")}
                disabled={busy}
                className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-border px-3 text-sm text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
