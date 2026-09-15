"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("You're signed out.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed.");
      setIsSigningOut(false);
    }
  };

  return { handleSignOut, isSigningOut };
}
