"use client";

import { Loader2, LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useSignOut } from "./use-sign-out";

export function SignOutMenuItem() {
  const { handleSignOut, isSigningOut } = useSignOut();

  return (
    <DropdownMenuItem
      disabled={isSigningOut}
      onSelect={(event) => {
        // Keep the menu mounted so the pending state stays visible until the redirect.
        event.preventDefault();
        void handleSignOut();
      }}
    >
      {isSigningOut ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      Sign out
    </DropdownMenuItem>
  );
}
