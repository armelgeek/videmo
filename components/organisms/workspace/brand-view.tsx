"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { SketchHint } from "@/components/molecules/sketch-hint";
import { Skeleton } from "@/components/ui/skeleton";
import { ORGANIZATION_CHANGED_EVENT } from "@/lib/app-shell/organization-events";
import { canCurateLibrary } from "@/lib/storyboard/library-roles";
import { BrandPanel } from "./members/brand-panel";
import { BrandTabs } from "./brand-tabs";

interface BrandOrganization {
  id: string;
  logo?: string | null;
  members: { userId: string; role: string }[];
}

/**
 * The logo half of the brand kit.
 *
 * It used to sit inside the members screen, which is where nobody looks for
 * it: a logo, the formats and the styles are one thing — what the videos of
 * this organization are made to look like.
 */
export function BrandView() {
  const { data: session } = useSession();
  const [organization, setOrganization] = useState<BrandOrganization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await authClient.organization.getFullOrganization();
    if (error) toast.error(error.message ?? "The organization could not be loaded.");
    setOrganization((data as unknown as BrandOrganization) ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onChange = () => {
      setIsLoading(true);
      load();
    };
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
  }, [load]);

  const myRole = organization?.members.find((m) => m.userId === session?.user.id)?.role;
  const canManage = canCurateLibrary(myRole);

  return (
    <div className="flex flex-col">
      <header className="px-6 pt-4 sm:px-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Workspace
        </p>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground">
            <span className="sk-marker">Brand kit</span>
          </h1>
          <SketchHint direction="left" className="hidden text-lg sm:flex">
            what every video here is made to look like
          </SketchHint>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your logo, the types of video you write, and the hand they are drawn with.
        </p>
      </header>

      <BrandTabs />

      <div className="px-6 py-8 sm:px-8">
        {isLoading ? (
          <Skeleton className="h-64 w-full max-w-xl rounded-lg" />
        ) : !organization ? (
          <p className="rounded-lg border-2 border-dashed border-border bg-accent/40 p-4 text-sm text-muted-foreground">
            Select an organization to set a logo.
          </p>
        ) : canManage ? (
          <div className="max-w-xl">
            <BrandPanel
              key={organization.id}
              organizationId={organization.id}
              initialLogo={organization.logo ?? null}
              onLogoChange={(logo) =>
                setOrganization((current) => (current ? { ...current, logo } : null))
              }
            />
          </div>
        ) : (
          <p className="rounded-lg border-2 border-dashed border-border bg-accent/40 p-4 text-sm text-muted-foreground">
            The logo is set by the owners and admins of this organization.
          </p>
        )}
      </div>
    </div>
  );
}
