"use client";

import { useState } from "react";
import { Edit2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrganizationNameEditorProps {
  organizationId: string;
  organizationName: string;
  isPersonal?: boolean;
  onUpdated?: (newName: string) => void;
}

export function OrganizationNameEditor({
  organizationId,
  organizationName,
  isPersonal = false,
  onUpdated,
}: OrganizationNameEditorProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(organizationName);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Organization name cannot be empty");
      return;
    }

    if (name === organizationName) {
      setOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.patch(`/api/organizations/${organizationId}`, {
        name: name.trim(),
      });

      if (!res.ok) {
        toast.error(res.error ?? "Failed to update organization");
        setName(organizationName);
        return;
      }

      toast.success("Organization renamed successfully");
      onUpdated?.(name.trim());
      setOpen(false);
    } catch (error) {
      toast.error("An error occurred while updating organization");
      setName(organizationName);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPersonal) {
    return (
      <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-foreground">
        {organizationName}
      </p>
    );
  }

  return (
    <>
      <div className="group flex items-center gap-2">
        <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-foreground">
          {organizationName}
        </p>
        <button
          onClick={() => {
            setName(organizationName);
            setOpen(true);
          }}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Edit organization name"
        >
          <Edit2 className="h-3.5 w-3.5 text-foreground hover:text-foreground" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>
              Update your personal workspace name
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter workspace name"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-ink focus:bg-accent"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setOpen(false);
              }}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                <Check className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
