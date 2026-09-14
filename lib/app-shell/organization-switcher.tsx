"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { slugify } from "@/lib/utils/string";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyOrganizationChanged } from "./organization-events";

function OrganizationMark({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-highlight text-highlight-foreground border-2 border-ink text-xs font-bold ">
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function OrganizationSwitcher() {
  const router = useRouter();
  const { data: organizations, refetch } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // A new user's personal organization is activated server-side on their
  // first project request, before the client session knows about it.
  const current = activeOrganization ?? (organizations?.length === 1 ? organizations[0] : null);

  const switchTo = async (organizationId: string) => {
    if (organizationId === current?.id) return;
    setSwitchingTo(organizationId);
    const { error } = await authClient.organization.setActive({ organizationId });
    setSwitchingTo(null);
    if (error) {
      toast.error(error.message ?? "Could not switch organization.");
      return;
    }
    notifyOrganizationChanged();
    router.refresh();
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    const { data, error } = await authClient.organization.create({
      name: trimmed,
      slug: `${slugify(trimmed)}-${crypto.randomUUID().slice(0, 6)}`,
    });
    if (!error && data) {
      await authClient.organization.setActive({ organizationId: data.id });
    }
    setIsCreating(false);
    if (error) {
      toast.error(error.message ?? "Could not create organization.");
      return;
    }
    toast.success(`Created ${trimmed}`);
    setIsCreateOpen(false);
    setName("");
    refetch();
    notifyOrganizationChanged();
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-highlight data-[state=open]:bg-accent">
          {current ? (
            <OrganizationMark name={current.name} />
          ) : (
            <span className="h-8 w-8 shrink-0 rounded-lg bg-accent motion-safe:animate-pulse" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Organization
            </span>
            <span className="block truncate text-sm font-semibold text-foreground">
              {current?.name ?? "Loading…"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-60 border-border bg-background text-foreground">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Switch organization
          </DropdownMenuLabel>
          {organizations?.map((organization) => (
            <DropdownMenuItem
              key={organization.id}
              onSelect={() => switchTo(organization.id)}
              className="gap-2"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[10px] font-bold">
                {(organization.name.trim()[0] ?? "?").toUpperCase()}
              </span>
              <span className="flex-1 truncate">{organization.name}</span>
              {switchingTo === organization.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                organization.id === current?.id && <Check className="h-3.5 w-3.5 text-foreground" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-accent" />
          <DropdownMenuItem onSelect={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <form onSubmit={create}>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                Projects you create next go to this organization. You can switch back anytime.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <label htmlFor="organization-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="organization-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Acme Studio"
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-highlight"
              />
            </div>
            <DialogFooter>
              <button
                type="submit"
                disabled={isCreating || !name.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-highlight text-highlight-foreground border-2 border-ink px-4 text-sm font-semibold disabled:opacity-50"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create organization
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
