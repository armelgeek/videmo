"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setConfirmation("");
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const { error } = await authClient.deleteUser({
        ...(password ? { password } : {}),
        callbackURL: "/",
      });
      if (error) {
        toast.error(error.message || "Failed to delete account");
        return;
      }
      toast.success("Your account has been deleted");
      router.push("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div>
        <div className="mb-4 flex items-start gap-3 border-b-2 border-border/60 pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-card text-destructive shadow-[2px_2px_0_hsl(var(--offset))]">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-foreground">Danger Zone</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently remove your account, projects and data.
            </p>
          </div>
        </div>

        <p className="mb-5 text-xs text-muted-foreground leading-relaxed">
          Once deleted, your account and all private whiteboard workspaces are gone forever.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-ink bg-card px-4 text-xs font-bold text-destructive shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete account
        </button>
      </div>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="border-2 border-ink shadow-[5px_5px_0_hsl(var(--offset))]">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Cancel any active subscription and transfer organizations you own first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
                className="border-2 border-border focus:border-ink"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty if you only sign in with Google or a magic link.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</Label>
              <Input
                id="delete-confirm"
                value={confirmation}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmation(e.target.value)}
                autoComplete="off"
                disabled={isLoading}
                className="border-2 border-border focus:border-ink font-mono font-bold"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading || confirmation !== CONFIRM_WORD}
              className="font-bold border-2 border-ink"
            >
              {isLoading ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
