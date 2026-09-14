"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvitationCardProps {
  invitationId: string;
  signedInEmail: string;
}

type InvitationState =
  | "loading"
  | "ready"
  | "processing"
  | "success"
  | "error-expired"
  | "error-email-mismatch"
  | "error-not-verified"
  | "error-already-member"
  | "error-not-found";

export function InvitationCard({ invitationId, signedInEmail }: InvitationCardProps) {
  const router = useRouter();
  const [state, setState] = useState<InvitationState>("loading");
  const [invitationDetails, setInvitationDetails] = useState<{
    organizationName: string;
    invitedEmail: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitation();
  }, [invitationId]);

  const loadInvitation = async () => {
    try {
      setState("loading");
      const res = await api.get(`/api/auth/organization/invitations/${invitationId}`);

      if (!res.ok) {
        if (res.error?.includes("expired")) {
          setState("error-expired");
          setError("This invitation link has expired. Please ask the organization admin to send a new one.");
        } else if (res.error?.includes("not found")) {
          setState("error-not-found");
          setError("Invitation not found. Please check the link and try again.");
        } else {
          setState("error-not-found");
          setError(res.error || "Could not load invitation details.");
        }
        return;
      }

      setInvitationDetails(res.data);

      if (res.data.invitedEmail !== signedInEmail) {
        setState("error-email-mismatch");
        setError(
          `This invitation was sent to ${res.data.invitedEmail}, but you're signed in as ${signedInEmail}. Please sign out and sign in with the correct email.`
        );
      } else {
        setState("ready");
      }
    } catch (err) {
      setState("error-not-found");
      setError("An unexpected error occurred. Please try again later.");
    }
  };

  const handleAcceptInvitation = async () => {
    if (state !== "ready") return;

    setState("processing");
    try {
      const res = await api.post(`/api/auth/organization/invitations/${invitationId}/accept`, {});

      if (!res.ok) {
        if (res.error?.includes("not verified")) {
          setState("error-not-verified");
          setError(
            "Your email address must be verified before joining an organization. Please check your email and verify your address, then try again."
          );
        } else if (res.error?.includes("already member")) {
          setState("error-already-member");
          setError("You are already a member of this organization.");
        } else if (res.error?.includes("expired")) {
          setState("error-expired");
          setError("This invitation has expired. Please ask for a new one.");
        } else {
          setState("error-not-found");
          setError(res.error || "Failed to accept invitation. Please try again.");
        }
        return;
      }

      setState("success");
      toast.success("Invitation accepted! Redirecting to workspace...");
      setTimeout(() => {
        router.push("/workspace");
      }, 1500);
    } catch (err) {
      setState("error-not-found");
      setError("An unexpected error occurred. Please try again later.");
    }
  };

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/invite/${invitationId}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invitation link copied to clipboard");
  };

  if (state === "loading") {
    return (
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-gray-400">Loading invitation details...</p>
        </CardContent>
      </Card>
    );
  }

  if (state === "success") {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            Invitation Accepted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-300">
            Welcome to <strong>{invitationDetails?.organizationName}</strong>! Redirecting you to the workspace...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle>You've been invited to an organization</CardTitle>
        <CardDescription>
          {invitationDetails
            ? `You were invited to join: ${invitationDetails.organizationName}`
            : "Loading invitation details..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error States */}
        {state === "error-expired" && (
          <Alert className="border-red-500/20 bg-red-500/5">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">{error}</AlertDescription>
          </Alert>
        )}

        {state === "error-email-mismatch" && (
          <Alert className="border-amber-500/20 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300">{error}</AlertDescription>
          </Alert>
        )}

        {state === "error-not-verified" && (
          <Alert className="border-amber-500/20 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300">{error}</AlertDescription>
          </Alert>
        )}

        {state === "error-already-member" && (
          <Alert className="border-blue-500/20 bg-blue-500/5">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-300">{error}</AlertDescription>
          </Alert>
        )}

        {state === "error-not-found" && (
          <Alert className="border-red-500/20 bg-red-500/5">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">{error}</AlertDescription>
          </Alert>
        )}

        {/* Ready State */}
        {state === "ready" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              You're signed in as <strong>{signedInEmail}</strong>. Click below to accept this invitation.
            </p>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleAcceptInvitation}
                disabled={state === "processing"}
                className="w-full bg-gradient-to-r from-rose-500 to-violet-500 hover:shadow-lg hover:shadow-rose-500/20"
              >
                {state === "processing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>

              <Button
                onClick={handleCopyLink}
                variant="ghost"
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Invitation Link
              </Button>
            </div>

            <p className="text-xs text-gray-500">
              Not the right account?{" "}
              <a href="/logout" className="text-rose-300 hover:text-rose-200">
                Sign out
              </a>{" "}
              and sign in with a different email.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
